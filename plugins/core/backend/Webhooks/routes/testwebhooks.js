/***********************************************************
 * JavaScript syntax format: ES5/ES6 - ECMAScript 2015
 * Loading all required dependencies, libraries and packages
 **********************************************************/
const express = require("express");
const router = express.Router();

const logger = require("../../../logger");

router.get("/test", function (req, res, next) {
    logger("success", "Called /testwebhooks/test API", req.originalUrl, req);
    res.send("pong");
});

router.post("/test_webhook_post/", function (req, res, next) {
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

router.delete("/test_webhook_del/:id", function (req, res, next) {
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

router.patch("/test_webhook_patch/:id", function (req, res, next) {
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
