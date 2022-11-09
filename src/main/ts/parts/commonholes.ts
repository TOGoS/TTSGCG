import ComplexAmount, {decodeComplexAmount, simpleDecodeComplexAmount} from "../ComplexAmount";
import Cut, { identityTransformations } from "../Cut";
import RationalNumber, {divide as frac} from "../RationalNumber";

export const number6PanelHoleDiameter     = {"inch": frac( 5, 32)};
export const barrelInletPanelHoleDiameter = {"inch": frac( 5, 16)};
export const led5mmHoleDiameter           = {"inch": frac(13, 64)};
export const toggleButtonHoleDiameter     = {"inch": frac( 1,  2)};

function unitedCut(cut:Cut) : Cut {
	return {
		classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
		unit: {"inch": frac(1,1)},
		transformations: identityTransformations,
		components: [cut]
	};
}

function roundHole(size:ComplexAmount, unitName="inch") : Cut {
	return unitedCut({
		classRef: "http://ns.nuke24.net/TTSGCG/Cut/RoundHole",
		diameter: simpleDecodeComplexAmount(size, unitName),
		depth: Infinity,
	});
}

export const number6PanelHole      : Cut = roundHole(number6PanelHoleDiameter    );
export const barrelInletPanelHole  : Cut = roundHole(barrelInletPanelHoleDiameter);
export const led5mmPanelHole       : Cut = roundHole(led5mmHoleDiameter          );
export const toggleButtonPanelHole : Cut = roundHole(toggleButtonHoleDiameter    );
