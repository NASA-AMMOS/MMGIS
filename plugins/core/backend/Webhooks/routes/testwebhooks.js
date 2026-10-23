/***********************************************************
 * JavaScript syntax format: ES5/ES6 - ECMAScript 2015
 * Loading all required dependencies, libraries and packages
 **********************************************************/
const express = require("express");
const router = express.Router();
const { authorize, resolvers } = require("../../../../../API/permissions/authorize");

const logger = require("../../../../../API/logger");

router.get("/test", authorize.public("development-only webhook test receiver"), function (req, res, next) {
    logger("success", "Called /testwebhooks/test API", req.originalUrl, req);
    res.send("pong");
});

router.post("/test_webhook_post/", authorize.public("development-only webhook test receiver"), function (req, res, next) {
    logger("success", "Called /testwebhooks/test_webhook_post API", req.originalUrl, req);
    logger("info", "Body of request\n" + JSON.stringify(req.body, null, 4), req.originalUrl, req);
    res.send({
        status: "success",
        message: "Received data to test_webhook_post API!",
        body: {
            input: req.body,
        }
    });
});

router.delete("/test_webhook_del/:id", authorize.public("development-only webhook test receiver"), function (req, res, next) {
    logger("success", "Called /testwebhooks/test_webhook_del API", req.originalUrl, req);
    logger("info", "Body of request\n" + JSON.stringify(req.body, null, 4), req.originalUrl, req);

    res.send({
        status: "success",
        message: "Received data to test_webhook_del API!",
        body: {
            params: req.params,
            input: req.body,
        }
    });

});

router.patch("/test_webhook_patch/:id", authorize.public("development-only webhook test receiver"), function (req, res, next) {
    logger("success", "Called /testwebhooks/test_webhook_patch API", req.originalUrl, req);
    logger("info", "Body of request\n" + JSON.stringify(req.body, null, 4), req.originalUrl, req);

    res.send({
        status: "success",
        message: "Received data to test_webhook_patch API!",
        body: {
            params: req.params,
            input: req.body,
        }
    });
});

module.exports = router;
