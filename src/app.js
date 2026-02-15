const express = require("express");
const swaggerUi = require("swagger-ui-express");
const openapi = require("./docs/openapi");

const app = express();

app.use(express.json());

// Health / root
app.get("/", (req, res) => {
  res.send("BakeLink backend is running");
});
app.get("/docs.json", (req, res) => {
  res.json(openapi);
});
app.use("/docs", swaggerUi.serve, swaggerUi.setup(openapi));

// Routes
app.use("/auth", require("./routes/auth"));
app.use("/users", require("./routes/users"));
app.use("/product-categories", require("./routes/productCategories"));
app.use("/products", require("./routes/products"));

module.exports = app;
