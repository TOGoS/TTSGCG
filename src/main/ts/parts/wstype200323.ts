// 3.5"-square TOGRackPanel with tiny 1/10" spaced holes

import { rectangularArrayPoints } from "../cuts";
import Part from "../Part";
import { DISTANCE_UNITS } from "../units";
import * as camt from "../ComplexAmount";
import { makeTogRackPanel, parsePartOptions } from "./tograckpanel";
import { pinHole } from "./commonholes";

export function makePart(params:{[k:string]: any}) : Part {
	if( params.length == undefined ) params.length = "3.5in";
	if( params.labelFontSize == undefined ) params.labelFontSize = "3/10in";
	const options = {
		...parsePartOptions(params)
	};

	const length = camt.decode(options.length, "inch", DISTANCE_UNITS);

	const pinholePoints =
		rectangularArrayPoints({
			countX: Math.floor(length * 10 - 2),
			countY: 25,
			cx: length/2,
			cy: 1.75,
			dx: 1/10,
			dy: 1/10,
		}).filter( point => ( point.x > 2+7/10 || point.y < 3-4/10 ) );
		// TODO: Use actual text dimensions

	options.extraCuts = [
		{
			classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
			transformations: pinholePoints,
			components: [pinHole]
		}
	];
	return {
		name: "WSTYPE-200323",
		cut: makeTogRackPanel(options)
	};
}

export default makePart;