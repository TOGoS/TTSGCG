import ComplexAmount from "../ComplexAmount";

// A standard set of options that makePart(...) functions may support, or not.
export default interface StandardPartOptions {
	labelText?: string;
	labelDepth: ComplexAmount;
	sketchDepth: ComplexAmount;
	variationString: "full"|"sketch"|string;
	maxPocketDepth?: ComplexAmount;
};
