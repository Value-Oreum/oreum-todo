require("./priority-smoke.cjs")(true).catch((e) => {
  console.error(e);
  process.exit(1);
});
