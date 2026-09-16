import { db } from "./index";
import { seedX4 } from "./seedData";

seedX4(db)
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
