import Cut, { CompoundCut, identityTransformations, RoundHole } from "./Cut";
import { boxPath, circlePath } from "./pathutils";
import { SimpleTransformation2D } from "./Transformish";

type X0OrCx<T=number> = {x0:T} | {cx:T};
type Y0OrCy<T=number> = {y0:T} | {cy:T};

type ArrayOptions<T=number> = {
	dx:number, countX:number,
	dy:number, countY:number,
} & X0OrCx<T> & Y0OrCy<T> & { minimizeDistance?: boolean };

function noZero(x:number):number {
	if( x == 0 ) throw new Error("noZero was passed zero")
	return x;
}

function extractX0<T extends number>(p:X0OrCx<T>, width:T) : number {
	return (p as {x0?:T}).x0 ?? (p as {cx:T}).cx - width/2;
}
function extractY0<T extends number>(p:Y0OrCy<T>, width:T) : number {
	return (p as {y0?:T}).y0 ?? (p as {cy:T}).cy - width/2;
}

export function rectangularArrayPoints(options:ArrayOptions):SimpleTransformation2D[] {
	const dx = noZero(options.dx);
	const dy = noZero(options.dy);
	const width  = options.dx * (options.countX-1);
	const height = options.dy * (options.countY-1);
	const x0 = extractX0(options, width);
	const y0 = extractY0(options, height);
	const x1 = x0 + width;
	const y1 = y0 + height;
	const points:SimpleTransformation2D[] = [];
	
	// Order points to minimize distance between adjacent ones,
	// by switching direction each row
	if( options.minimizeDistance ?? true ) {
		if( options.dx < options.dy ) {
			//console.warn(`Using X-then-Y point order; countX=${options.countX}, countY=${options.countY}`)
			for( let j=0; j<options.countY; ++j ) {
				for( let i=0; i<options.countX; ++i ) {
					points.push({
						x: ((j&1) == 0) ? (x0 + i*dx) : (x1 - i*dx),
						y: y0 + j*dy,
					});
				}
			}
		} else {
			//console.warn("Using Y-then-X point order")
			for( let i=0; i<options.countX; ++i ) {
				for( let j=0; j<options.countY; ++j ) {
					points.push({
						x: x0 + i*dx,
						y: ((i&1) == 0) ? (y0 + j*dy) : (y1 - j*dy),
					});
				}
			}
		}
	} else {
		for( let j=0; j<options.countY; ++j ) {
			for( let i=0; i<options.countX; ++i ) {
				points.push({x: x0 + i*dx, y: y0 + j*dy});
			}
		}
	}
	
	return points;
}

export function roundHole(diameter:number, depth:number) : RoundHole {
	return {
		classRef: "http://ns.nuke24.net/TTSGCG/Cut/RoundHole",
		diameter,
		depth,
	};
}

export function slot(width:number, height:number, depth:number) : Cut {
	return {
		classRef: "http://ns.nuke24.net/TTSGCG/Cut/TracePath",
		path: boxPath({
			cornerOptions: { cornerRadius: Math.min(width, height)/2, cornerStyleName: "Round" },
			cx: 0, cy: 0,
			width, height,
		}),
		spaceSide: "left", // box is counter-clockwise, so left is the 'inside' of the hole.
		depth,
	};
}

export function rectangularArray(cuts:Cut[], options:ArrayOptions):Cut {
	return {
		classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
		transformations: rectangularArrayPoints(options),
		components: cuts,
	};
}

/**
 * A circle with a dot in the middle, which can be used to represent a hole
 * that will be drilled separately (e.g. using a hand drill or drill press).
 */
export function sketchHole(diameter:number, edgeDepth:number, centerDepth:number) : CompoundCut {
	return {
		classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
		transformations: identityTransformations,
		components: [
			{
				classRef: "http://ns.nuke24.net/TTSGCG/Cut/TracePath",
				spaceSide: "middle",
				path: circlePath(diameter/2),
				depth: edgeDepth,
			},
			{
				classRef: "http://ns.nuke24.net/TTSGCG/Cut/RoundHole",
				diameter: 0,
				depth: centerDepth,
			}
		]
	}
}
