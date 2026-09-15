import test from "node:test";import assert from "node:assert/strict";import { MODEL_REGISTRY } from "../src/config/models.js";import { config } from "../src/config/index.js";
test("baseline model registry has English + Hindi Vosk and Piper",()=>{assert.equal(MODEL_REGISTRY.vosk.length,2);assert.equal(MODEL_REGISTRY.piper.length,2);assert.equal(MODEL_REGISTRY.llm[0].default,true)});
test("default runtime uses node-llama-cpp through Node",()=>{assert.equal(config.llmModel,"qwen25-0.5b-q2")});
test("vision is intentionally not part of the registry",()=>{assert.equal(Object.prototype.hasOwnProperty.call(MODEL_REGISTRY,"vision"),false)});
