/* eslint-disable no-undef */

'use strict';

/* global empty */
var server = require('server');
var csrfProtection = require('*/cartridge/scripts/middleware/csrf');
var consentTracking = require('*/cartridge/scripts/middleware/consentTracking');
var sharedCartMiddleware = require('*/cartridge/scripts/middleware/sharedCart');

var page = module.superModule;
server.extend(page);

/**
 * Internal function for performing validation operations regarding payment methods for the products in the cart.
 * Used in the appends for the 'Show' and 'MiniCartShow' endpoints.
 * @param {dw.system.Request} req - The request object
 * @param {dw.system.Response} res - The response object
 * @param {Object} next - The next object
 * @param {boolean} isMiniCart - true if we are showing the mini cart
*/
function extendCartModel(req, res, next, isMiniCart) {
    var BasketMgr = require('dw/order/BasketMgr');
    var Resource = require('dw/web/Resource');
    var Transaction = require('dw/system/Transaction');
    var cartHelpers = require('app_storefront_wivai/cartridge/scripts/cart/cartHelpers');
    var validationHelpers = require('*/cartridge/scripts/helpers/basketValidationHelpers');
    var DMWHelper = require('dmwhelper');
    var TotalsModel = require('*/cartridge/models/totals');

    var viewData = res.getViewData();

    if (viewData.items.length > 0) {
        var isLegalPerson = false;
        var profile = req.currentCustomer.profile;
        if (profile) {
            var customerInfoObject = JSON.parse(req.session.privacyCache.get('profileInfo') || '{}');
            isLegalPerson = customerInfoObject.isLegalPerson ? customerInfoObject.isLegalPerson : false;
        }
        var newCartModel = cartHelpers.checkIncompatibilities(viewData, isLegalPerson);
        var currentBasket = BasketMgr.getCurrentBasket();

        if (newCartModel.valid.error === false) {
            newCartModel = cartHelpers.checkCartPayments(viewData);
            var cartError = req.querystring.error;

            // validate if the product is insurance type
            var isSecure = false;
            isSecure = cartHelpers.checkInsuranceProduct(viewData);

            // validate payment method if the product is not insurance
            if (isSecure === true || newCartModel.basketPaymentMethod.isPAILoan() || newCartModel.basketPaymentMethod.isMYBOX()) {
                newCartModel.redirectToNOW = true;
                newCartModel.paramsNOW = cartHelpers.getRedirectToNOWParameters(newCartModel);
            } else {
                newCartModel.redirectToNOW = false;
                newCartModel.paramsNOW = null;
            }

            if (newCartModel.valid.error === false) {
                Transaction.wrap(function () {
                    currentBasket.custom.basketPaymentMethod = newCartModel.basketPaymentMethod.value;
                    currentBasket.custom.basketTotalQuote = DMWHelper.isEmpty(newCartModel.totals.totalQuote)
                        ? ''
                        : JSON.stringify(newCartModel.totals.totalQuote);
                });

                // Recalculate the totals
                var totalQuote = newCartModel.totals.totalQuote;
                newCartModel.totals = new TotalsModel(currentBasket);
                newCartModel.totals.totalQuote = totalQuote;
            } else if (cartError && cartError === '1') {
                // We invalidate the calculated error message and put the real one
                newCartModel.valid.message = Resource.msg('error.cart.can.not.set.one.payment', 'cart', null);
            }
        } else {
            // We need to know if the error comes from an invalid coupon
            var validCoupons = validationHelpers.validateCoupons(currentBasket);
            if (validCoupons.error) {
                newCartModel.isInvalidCoupon = true;
            } else {
                newCartModel.isInvalidCoupon = false;
            }
        }

        res.setViewData(newCartModel);
    }

    // session.privacy.notAddedProduct is no longer necessary
    // only delete it on Cart-Show
    if (isMiniCart === false && res.getViewData().isBasketSyncSuccsesfully === true) {
        delete session.privacy.notAddedProduct; // eslint-disable-line
    }

    next();
}

/**
 * Cart-Show : This append performs validation operations regarding payment methods for the products in the cart
 * @name Base/Cart-Show
 * @function
 * @memberof Cart
 */
server.append(
    'Show',
    server.middleware.https,
    consentTracking.consent,
    csrfProtection.generateToken,
    function (req, res, next) {
        updateSetFlag(req, res, next);
        extendCartModel(req, res, next, false);
    }
);

/**
 * Cart-MiniCartShow : Append to the MiniCart
 * @name Base/Cart-MiniCartShow
 * @function
 * @memberof Cart
 * @param {category} - sensitive
 * @param {renders} - isml
 * @param {serverfunction} - get
 */
server.append('MiniCartShow', function (req, res, next) {
    extendCartModel(req, res, next, true);
});

module.exports = server.exports();