import type { Config } from "jest"

const config: Config = {
  verbose: true,
  preset: "ts-jest",
  testEnvironment: "node",
  // Vitest / private local packages — keep them out of root Jest.
  // Node-native ESM WASM round-trips live in *.node.test.ts (tsx --test).
  testPathIgnorePatterns: [
    "/node_modules/",
    "/packages/dwg-converter/",
    "\\.node\\.test\\.ts$",
  ],
  moduleNameMapper: {
    // NodeNext sources use .js specifiers; map them back to .ts for ts-jest.
    "^(\\.{1,2}/.*)\\.js$": "$1",
    "^@mlightcad/common$": "<rootDir>/packages/common/src/index.ts",
    "^@mlightcad/geometry-engine$": "<rootDir>/packages/geometry-engine/src/index.ts",
    "^@mlightcad/graphic-interface$": "<rootDir>/packages/graphic-interface/src/index.ts",
    "^@mlightcad/data-model$": "<rootDir>/packages/data-model/src/index.ts",
    "^@mlightcad/libredwg-converter$": "<rootDir>/packages/libredwg-converter/src/index.ts",
  },
  transform: {
    "^.+\\.(ts|tsx)$": "ts-jest",
  },
}

export default config
