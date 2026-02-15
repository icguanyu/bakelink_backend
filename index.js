const { port } = require("./src/config");
const app = require("./src/app");

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
