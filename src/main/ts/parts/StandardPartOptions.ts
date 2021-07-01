import ComplexAmount from "../ComplexAmount";

// A standard set of options that makePart(...) functions may support, or not.
export default interface StandardPartOptions {
    labelText: String;
    labelDepth: ComplexAmount;
    sketchDepth: ComplexAmount;
    variationString: "full"|"sketch"|string;
};
