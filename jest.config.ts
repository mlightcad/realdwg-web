import type { Config } from "jest"

const config: Config = {
  verbose: true,
  preset: "ts-jest",
  testEnvironment: "node",
  moduleNameMapper: {
    "^@mlightcad/common$": "<rootDir>/packages/common/src/index.ts",
    "^@mlightcad/geometry-engine$": "<rootDir>/packages/geometry-engine/src/index.ts",
    "^@mlightcad/graphic-interface$": "<rootDir>/packages/graphic-interface/src/index.ts",
    "^@mlightcad/data-model$": "<rootDir>/packages/data-model/src/index.ts",
    "^@mlightcad/dxf-json-converter$": "<rootDir>/packages/dxf-json-converter/src/index.ts",
    "^@mlightcad/dxf-json/types$":
      "<rootDir>/packages/dxf-json-converter/node_modules/@mlightcad/dxf-json/dist/cjs/types-bundle.cjs",
  },
  transform: {
    ".*packages[\\\\/]dxf-json-converter[\\\\/].+\\.tsx?$": [
      "ts-jest",
      { tsconfig: "<rootDir>/packages/dxf-json-converter/tsconfig.json" }
    ],
    "^.+\\.(ts|tsx)$": "ts-jest",
  },
  testPathIgnorePatterns: ["packages/dxf-json/"]
}

export default config
