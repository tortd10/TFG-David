'use strict';

/* global empty */
var server = require('server');

var page = module.superModule;
server.extend(page);

server.append(
    'IncludeHeaderMenu',
    function (req, res, next) {
        if (!empty(req.querystring)) {
            if (!empty(req.querystring.cgid)) {
                var catalogMgr = require('dw/catalog/CatalogMgr');
                var selectedCategory = catalogMgr.getCategory(req.querystring.cgid);

                if (!empty(selectedCategory) && !empty(selectedCategory.custom.hideMenuInCategory)) {
                    var viewData = res.getViewData();

                    viewData.hideMenuInCategory = selectedCategory.custom.hideMenuInCategory;

                    res.setViewData(viewData);
                }
            }
        }

        next();
    }
);

module.exports = server.exports();