import { describe, expect, it } from "vitest";
import { calculateValue, classifyEdge, fairProbabilities } from "../worker/value";
describe("value calculations", () => {
  it("removes a 1X2 overround proportionally", () => { const result=fairProbabilities({home:2,draw:3.5,away:4}); expect(result.overround).toBeCloseTo(3.5714,3); expect(Object.values(result.probabilities).reduce((a,b)=>a+b,0)).toBeCloseTo(1,8); expect(result.probabilities.home).toBeCloseTo(.48276,4); });
  it("calculates edge and expected return independently", () => { const result=calculateValue(.52,2.1,.47,5); expect(result.edge).toBeCloseTo(5); expect(result.expectedReturn).toBeCloseTo(9.2); });
  it("applies every MC Predict band boundary", () => { expect(classifyEdge(10.01)).toBe("High"); expect(classifyEdge(5.01)).toBe("Good"); expect(classifyEdge(.01)).toBe("Some"); expect(classifyEdge(-4.99)).toBe("No"); expect(classifyEdge(-9.99)).toBe("Bad"); expect(classifyEdge(-10)).toBe("Very bad"); });
});
