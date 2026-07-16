const app = require("./app");

const PORT = 5000;
app.listen(PORT, (error) => {
  if (error) throw error;
  console.log(`Server running on port ${PORT}`);
});
