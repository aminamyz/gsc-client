'use strict';

gsc.map = (function() {

  /**
   * @exports gsc/map
   */
  var mod = {};

  /** @type ol.map */
  mod.olMap = null;

  /** @type mapOptions */
  mod.mapOptions_ = null;

  /**
   * Create a map with standard functions (pan,zoom, view layers) and
   * other optional  specific functionality as info on feature and filter
   * on attributes
   *
   * @param {divObject} divObject is the map div
   * @param {mapOptions} mapOptions are the map options
   */
  mod.create  = function(divObject, mapOptions) {
    mod.mapOptions_ = mapOptions;
    mod.layers_ = mapOptions.layers || [];

    var projection = new ol.proj.Projection({
      code: mapOptions.epsg,
      units: mapOptions.units
    });

    mod.olMap = new ol.Map({
      controls: ol.control.defaults({
        attribution: false
      }),
      layers: mod.layers_,
      target: divObject,
      view: new ol.View({
        projection: projection
      })
    });

    if (mod.mapOptions_.bounds) {
      mod.olMap.getView().fit(mod.mapOptions_.bounds, mod.olMap.getSize());
    }
  };

  /**
   * Add layer to existing map
   *
   * @param {ol.layer} layer layer to show in map
   */
  mod.addLayer = function(layer) {
    mod.olMap.addLayer(layer);
    mod.layers_.push(layer);
  };

  /**
   * Return element of map viewport
   *
   * @return {element} DOM element of viewport
   */
  mod.getDomElement = function() {
    return $(mod.olMap.getViewport());
  };

  /**
   * Return ol map object
   *
   * @return {ol.map} map object
   */
  mod.getOlMap = function() {
    return mod.olMap;
  };

  /**
   * Redraw all layers
   *
   */
  mod.redraw = function() {
    mod.olMap.getLayers().forEach(function(lyr) {
      lyr.redraw();
    });
  };

  /**
   * Remove layer from map
   *
   */
  mod.removeLayer = function(layer) {
    mod.olMap.removeLayer(layer);
    mod.layers_ = mod.layers_.filter(function(value) {
      return value !== layer;
    });
  };

  /**
   * Fit to features
   *
   * @param {el.extent} bounds
   */
  mod.fit = function(bounds) {
    mod.olMap.getView().fit(bounds, mod.olMap.getSize());
  };

  mod.addMousePositionControl = function(location) {
    var mousePositionControl = new ol.control.MousePosition({
        className: 'custom-mouse-position',
        target: document.getElementById(location),
        coordinateFormat: ol.coordinate.createStringXY(5),
        undefinedHTML: '&nbsp;'
      });
    mod.olMap.addControl(mousePositionControl);
  };

  mod.addScaleBarControl = function(scalediv) {
    mod.olMap.getView().on('change:resolution', function(evt) {
      var resolution = evt.target.get('resolution');
      var units = mod.olMap.getView().getProjection().getUnits();
      var dpi = 25.4 / 0.28;
      var mpu = ol.proj.METERS_PER_UNIT[units];
      var scale = resolution * mpu * 39.37 * dpi;
      if (scale >= 9500 && scale <= 950000) {
        scale = Math.round(scale / 1000) + 'K';
      } else if (scale >= 950000) {
        scale = Math.round(scale / 1000000) + 'M';
      } else {
        scale = Math.round(scale);
      }
      document.getElementById(scalediv).innerHTML = 'Scale = 1 : ' + scale;
    });
    //fire change resolution event and restore previous configuration
    mod.olMap.getView().setZoom(mod.olMap.getView().getZoom() + 1);
    mod.olMap.getView().setZoom(mod.olMap.getView().getZoom() - 1);
  };

  mod.infoOnFeatureEvent = function(evt) {
    document.getElementById(this.nodelist).innerHTML = 'Loading... please ' +
    'wait...';
    var view = mod.olMap.getView();
    var viewResolution = view.getResolution();
    var source = this.layer.getSource();
    var url = source.getGetFeatureInfoUrl(
      evt.coordinate, viewResolution, view.getProjection(),
      {'INFO_FORMAT': 'text/html',
             'FEATURE_COUNT': this.maxFeaturesNumber
      });
    if (this.executor.rejectFn && this.executor.resolveFn) {
      var resolve = this.executor.resolveFn;
      var reject = this.executor.rejectFn;
      var req = new window.XMLHttpRequest();
      req.onload  = function() {
        if (this.status == 200) {
          var responseDoc = document.createElement('html');
          responseDoc.innerHTML  = this.responseText;
          var layers = responseDoc.getElementsByTagName('table');
          if (layers) {
            var objResponse = {};
            for (var i = 0; i < layers.length; i++) {
              var name = (layers[i].caption ?
              layers[i].caption.innerText : i);
              objResponse[name] = [];
              if (layers[i].rows && layers[i].rows.length >= 2) {
                for (var j = 1; j < layers[i].rows.length; j++) {
                  var feature = {};
                  for (var k = 0; k < layers[i].rows[0].cells.length; k++) {
                    var key = layers[i].rows[0].cells[k].innerText;
                    var value = layers[i].rows[j].cells[k].innerText;
                    feature[key] = value;
                  }
                  objResponse[name].push(feature);
                }
              }
            }
            resolve(objResponse);
          } else {
            resolve(null);
          }
        } else {
          reject(this.statusText);
        }
      };
      req.open('GET',url,true);
      req.setRequestHeader('X-Requested-With','XMLHttpRequest');
      req.setRequestHeader('Content-Type','text/xml');
      req.send();
    }
    if (url) {
      document.getElementById(this.nodelist).innerHTML = '<iframe seamless ' +
      'src="' + url + '"></iframe>';
    }
  };

  mod.addInfoOnFeatureEvent = function(nodelist, maxFeaturesNumber, layer) {
    var prom;
    if (window.Promise) {
      prom = new window.Promise(function(resolve, reject) {
      var opts = {
        nodelist: nodelist,
        maxFeaturesNumber: maxFeaturesNumber,
        layer: layer,
        executor: {
          resolveFn: resolve,
          rejectFn: reject
        }
      };
      mod.olMap.on('singleclick', mod.infoOnFeatureEvent, opts);
    });
    }else {
      prom = new Promise(function(resolve, reject) {// jshint ignore:line
        var opts = {
        nodelist: nodelist,
        maxFeaturesNumber: maxFeaturesNumber,
        layer: layer,
        executor: {
          resolveFn: resolve,
          rejectFn: reject
        }
      };
        mod.olMap.on('singleclick', mod.infoOnFeatureEvent, opts);
      });
    }
    return prom;
  };

  mod.removeInfoOnFeatureEvent = function() {
    mod.olMap.on('singleclick', mod.infoOnFeatureEvent);
  };

  mod.filterOnAttributes = function(filterType, filter) {
    // by default, reset all filters
    var filterParams = {
          'FILTER': null,
          'CQL_FILTER': null,
          'FEATUREID': null
        };
    if (filter.replace(/^\s\s*/, '').replace(/\s\s*$/, '') !== '') {
      if (filterType === 'cql') {
        filterParams.CQL_FILTER = filter;
      }
      if (filterType === 'ogc') {
        filterParams.FILTER = filter;
      }
      if (filterType === 'fid') {
        filterParams.FEATUREID = filter;
      }
    }
    // merge the new filter definitions
    mod.olMap.getLayers().forEach(function(lyr) {
            lyr.getSource().updateParams(filterParams);
          });
  };

  mod.resetFilter = function() {
    mod.filterOnAttributes('cql','');
  };

  return mod;

}());
