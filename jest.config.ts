import type { Config } from "jest"

const config: Config = {
  verbose: true,
  preset: "ts-jest",
  testEnvironment: "node",
  // Vitest suites live under packages/emf-converter; keep them out of root Jest.
  testPathIgnorePatterns: ["/node_modules/", "/packages/emf-converter/"],
  moduleNameMapper: {
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
