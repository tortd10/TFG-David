'use strict';

var server = require('server');

var cache = require('*/cartridge/scripts/middleware/cache');
var consentTracking = require('*/cartridge/scripts/middleware/consentTracking');
var pageMetaData = require('*/cartridge/scripts/middleware/pageMetaData');
var CatalogMgr = require('dw/catalog/CatalogMgr');

var page = module.superModule;
server.extend(page);

server.append('Show',
    server.middleware.https,
    cache.applyShortPromotionSensitiveCache,
    consentTracking.consent,
    function (req, res, next) {
        var productHelper = require('*/cartridge/scripts/helpers/productHelpers');
        var viewData = res.getViewData();

        var breadcrumbs = [];

        if (viewData.productSearch.category) {
            breadcrumbs = productHelper.getAllBreadcrumbs(viewData.productSearch.category.id, null, []).reverse();
        } else if (viewData.productSearch.pid) {
            breadcrumbs = productHelper.getAllBreadcrumbs(null, viewData.productSearch.pid, []).reverse();
        }

        viewData.breadcrumbs = breadcrumbs;

        viewData.compareEnabled = getCategoryCompareStatus(viewData.productSearch);

        var allowFeaturedProducts = false;
        if (!empty(viewData.apiProductSearch.category)) {
            allowFeaturedProducts = viewData.apiProductSearch.category.custom.allowFeaturedProducts;
        }
        viewData.allowFeaturedProducts = allowFeaturedProducts;
        res.setViewData(viewData);

        return next();
    }, pageMetaData.computedPageMetaData);

module.exports = server.exports();