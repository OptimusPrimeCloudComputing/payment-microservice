const express = require("express");
const swaggerUi = require("swagger-ui-express");
const yaml = require("yamljs");

const app = express();
const swaggerDocument = yaml.load("./openapi/openapi.yaml");

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.listen(4003, () => console.log("Docs at http://localhost:4003/api-docs"));
