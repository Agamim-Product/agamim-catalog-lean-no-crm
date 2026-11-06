/*
 * Local datasets overlay.
 *
 * The catalog is a static site: every data file is read with
 * fetch("data/consumer/<name>"). Datasets a product manager registers with
 * add-dataset.html are kept in localStorage; this script wraps window.fetch so
 * those datasets appear in the catalog (lists, detail pages, samples) as if
 * they were published files. Anything it does not recognise passes through
 * untouched, and any failure falls back to the real fetch.
 *
 * Storage: localStorage["agamim-local-datasets-v1"] = [
 *   { repoId, layerId, savedAt, files: { "<file name>": <json | csv text> }, list: { repo, layer } }
 * ]
 * Once a dataset is published into data/consumer/ (via tools/apply-package.ps1)
 * the published copy wins and the local one is ignored.
 */
(function () {
  "use strict";

  var KEY = "agamim-local-datasets-v1";
  var DATA_RE = /data\/consumer\/([^?#\/]+\.(?:json|csv))(?:[?#].*)?$/;

  function load() {
    try {
      var a = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(a) ? a : [];
    } catch (e) {
      return [];
    }
  }

  function save(list) {
    localStorage.setItem(KEY, JSON.stringify(list));
  }

  window.__agamimLocalDatasets = { key: KEY, load: load, save: save };

  var realFetch = window.fetch;
  if (typeof realFetch !== "function") return;

  function bump(map, key) {
    if (key === undefined || key === null) return;
    map[key] = (map[key] || 0) + 1;
  }

  function mergeRepos(data, local) {
    var have = {};
    data.items.forEach(function (r) { have[r.id] = true; });
    local.forEach(function (d) {
      var r = d.list && d.list.repo;
      if (!r || have[r.id]) return;
      data.items.push(r);
      have[r.id] = true;
      var f = data.facets || (data.facets = {});
      bump((f.access = f.access || {}), r.restricted ? "locked" : "open");
      bump((f.core = f.core || {}), r.core);
      bump((f.value = f.value || {}), r.valueLevel);
      bump((f.phase = f.phase || {}), r.phase);
      bump((f.owner = f.owner || {}), r.ownerHe);
      bump((f.frequency = f.frequency || {}), r.card && r.card.cadence);
      if (!r.restricted) {
        bump((f.slo = f.slo || {}), r.sloStatus);
        bump((f.verdict = f.verdict || {}), r.quality && r.quality.verdict);
      }
    });
    data.total = data.items.length;
    return data;
  }

  function mergeLayers(data, local) {
    var have = {};
    data.items.forEach(function (l) { have[l.id] = true; });
    local.forEach(function (d) {
      var l = d.list && d.list.layer;
      if (!l || have[l.id]) return;
      data.items.push(l);
      have[l.id] = true;
      var f = data.facets || (data.facets = {});
      bump((f.tier = f.tier || {}), l.tier);
      bump((f.kind = f.kind || {}), l.kind);
      bump((f.owner = f.owner || {}), l.ownerHe);
    });
    data.total = data.items.length;
    return data;
  }

  function reply(body, type) {
    return new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": type }
    });
  }

  window.fetch = function (input, init) {
    var args = arguments;
    var self = this;
    var url = "";
    try {
      url = typeof input === "string" ? input : (input && input.url) || String(input || "");
    } catch (e) {}

    var m = DATA_RE.exec(url);
    var local = m ? load() : [];
    if (!m || !local.length) return realFetch.apply(self, args);

    var name = m[1];
    var isList = name === "repositories.json" || name === "layers.json";
    var mine = null;
    if (!isList) {
      for (var i = 0; i < local.length; i++) {
        if (local[i].files && Object.prototype.hasOwnProperty.call(local[i].files, name)) {
          mine = local[i];
          break;
        }
      }
      if (!mine) return realFetch.apply(self, args);
    }

    // Is the dataset already published as a real file? Then the real file wins.
    var repoListUrl = url.replace(/data\/consumer\/[^?#]*/, "data/consumer/repositories.json");
    return realFetch.call(self, repoListUrl)
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; })
      .then(function (repos) {
        var published = {};
        ((repos && repos.items) || []).forEach(function (r) { published[r.id] = true; });
        var active = local.filter(function (d) { return !published[d.repoId]; });

        if (isList) {
          return realFetch.apply(self, args).then(function (res) {
            if (!res.ok || !active.length) return res;
            return res.clone().json().then(function (data) {
              var merged = name === "repositories.json" ? mergeRepos(data, active) : mergeLayers(data, active);
              return reply(merged, "application/json");
            }).catch(function () { return res; });
          });
        }

        if (published[mine.repoId]) return realFetch.apply(self, args);
        var body = mine.files[name];
        return reply(body, /\.csv$/.test(name) ? "text/csv; charset=utf-8" : "application/json");
      })
      .catch(function () { return realFetch.apply(self, args); });
  };
})();
