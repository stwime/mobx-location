import { set, observable, action, autorun, toJS, observe, runInAction } from 'mobx';
import queryString from 'query-string';
import 'history-events';

var propsToMirror = ['hash', 'host', 'hostname', 'href', 'origin', 'pathname', 'port', 'protocol', 'search'];
var _window = window,
    location = _window.location;
var mobxLocation = (function (_ref) {
  var hashHistory = _ref.hashHistory,
      _ref$arrayFormat = _ref.arrayFormat,
      arrayFormat = _ref$arrayFormat === void 0 ? 'bracket' : _ref$arrayFormat;

  var createSnapshot = function createSnapshot(previousQuery) {
    var snapshot = propsToMirror.reduce(function (snapshot, prop) {
      snapshot[prop] = location[prop];
      return snapshot;
    }, {});
    var q;

    if (hashHistory) {
      q = queryString.parse(snapshot.hash.split('?')[1], {
        arrayFormat: arrayFormat
      });
    } else {
      q = queryString.parse(snapshot.search, {
        arrayFormat: arrayFormat
      });
    }

    snapshot.query = q || {};
    return snapshot;
  };

  var firstSnapshot = createSnapshot();
  var locationObservable = observable(firstSnapshot);
  /**
   * executes each time a mobxLocation.query is mutated
   */

  var propagateQueryToLocationSearch = function propagateQueryToLocationSearch() {
    var queryInObservable = queryString.stringify(toJS(locationObservable.query), {
      encode: false,
      arrayFormat: arrayFormat
    }); // console.log('currentlyInObservable: ', currentlyInObservable)

    var search = location.search,
        protocol = location.protocol,
        host = location.host,
        pathname = location.pathname,
        hash = location.hash;
    var qs = search;
    var hashParts = hash.split('?');

    if (hashHistory && hash.includes('?')) {
      qs = hashParts[1];
    }

    if (!qs && !queryInObservable) {
      return;
    }

    if (decodeURI(qs) === queryInObservable) {
      return;
    }

    if (qs !== queryInObservable) {
      var newUrl = protocol + '//' + host + pathname;

      if (hashHistory) {
        var newHash = hashParts[0] + '?' + queryInObservable;
        locationObservable.hash = newHash;
        newUrl += newHash;
      } else {
        var newSearch = '?' + queryInObservable + hash;
        runInAction(function () {
          return locationObservable.search = newSearch;
        });
        newUrl += newSearch;
      }

      runInAction(function () {
        return locationObservable.href = newUrl;
      });
      window.removeEventListener('changestate', snapshotAndSet); // console.log('newUrl: ', newUrl)

      history.replaceState(null, '', newUrl);
      window.addEventListener('changestate', snapshotAndSet);
    }
  };

  var unsubscribe = autorun(propagateQueryToLocationSearch);
  var snapshotAndSet = action('changestateHandler', function (ev) {
    var snapshot = createSnapshot(toJS(locationObservable.query));
    var currentlyInObservable = toJS(locationObservable); //unfortunately we need to check that the new snapshot is different-for example when integrating with angularjs it happens that angular router is setting a URL again after we changed it via interacting with observable

    if (snapshot.href !== currentlyInObservable && decodeURI(snapshot.href) !== locationObservable.href) {
      set(locationObservable, snapshot);
    }
  });
  observe(locationObservable, function (change) {
    var name = change.name;

    if (name === 'query') {
      return; // we ignore these
    }

    if (location[change.name] !== change.newValue) {
      var search = locationObservable.search,
          protocol = locationObservable.protocol,
          host = locationObservable.host,
          pathname = locationObservable.pathname,
          hash = locationObservable.hash;
      var newUrl = protocol + '//' + host + pathname + search + hash;
      window.removeEventListener('changestate', snapshotAndSet);

      if (change.name === 'search') {
        unsubscribe();
        locationObservable.query = queryString.parse(change.newValue, {
          arrayFormat: arrayFormat
        });
        unsubscribe = autorun(propagateQueryToLocationSearch);
      }

      history.pushState(null, '', newUrl);
      window.addEventListener('changestate', snapshotAndSet);
    }
  });
  window.addEventListener('changestate', snapshotAndSet);
  return locationObservable;
});

export default mobxLocation;
