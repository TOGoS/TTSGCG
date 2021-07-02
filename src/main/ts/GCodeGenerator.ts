import * as aabb from './aabb';
import { AABB3D } from './aabb';
import * as vectormath from './vectormath';
import { TransformationMatrix3D, Vector3D, zeroVector } from './vectormath';

import Cut, { ConicPocket, Pause } from './Cut';
import { CornerStyleName, circlePath } from './pathutils';
import * as rational from './RationalNumber';
import ComplexAmount, { decodeComplexAmount, addComplexAmounts, scaleComplexAmount, parseComplexAmount, formatComplexAmount } from './ComplexAmount';
import Transformish, { toTransformationMatrix3D } from './Transformish';

function vectorToString(v:Vector3D, digits=4):string {
	return "<"+v.x.toFixed(digits)+","+v.y.toFixed(digits)+","+v.z.toFixed(digits)+">";
}

/**
 * A job is a bunch of stuff that the machine should be able to do all at once.
 * Different jobs may require bit changes or other setup.
 */
interface Job
{
	name: string;
	cut: Cut;
}

function assertUnreachable(n:never) {
	throw new Error("Shouldn't've made it here: "+n);
}

interface RouterBit {
	name:string;
	diameterFunction:(depth:ComplexAmount)=>ComplexAmount;
}

interface JobContext {
	nativeUnit: Unit;
	minZ: ComplexAmount;
	routerBit: RouterBit;
}

type Brand<K, T> = K & { __brand: T }

type ModelVector = Brand<Vector3D, "vector in model space">;
type ModelDistance = Brand<number, "distance in model units">;
type NativePosition = Brand<Vector3D, "absolute position in native units">;
type NativeDistance = Brand<number, "distance in native units">;

abstract class ShapeProcessorBase {
	protected minZ:number;
	public fractionDigits:number = 4;

	abstract emitComment(c:string):void;

	protected fmtDist(n:number):string {
		if( isNaN(n) ) throw new Error("Oh no, number is NaN");
		return n.toFixed(this.fractionDigits);
	}

	// Stateful stuff
	protected currentTransformation:TransformationMatrix3D = vectormath.createIdentityTransform();
	// Scale of shape units in the current transformation.
	// This only makes sense if x and y have not been scaled independently.
	get currentHorizontalScale():number {
		return vectormath.vectorLength({x:this.currentTransformation.xx, y:this.currentTransformation.yx, z:0});
	}
	// Hopefully things haven't been rotated around x or y lol
	get currentVerticalScale():number {
		return this.currentTransformation.zz;
	}
	// The current transformation includes conversion from currentUnit to native units
	protected currentUnit:ComplexAmount;

	// These return transformed position in native units
	protected get currentPosition():NativePosition {
		return vectormath.transformVector(this.currentTransformation, zeroVector) as NativePosition;
	}
	protected get currentZ():NativeDistance { return this.currentPosition.z as NativeDistance; }
	protected get clampedZ():NativeDistance { return Math.max(this.minZ, this.currentPosition.z) as NativeDistance; }
	protected get currentDepth():NativeDistance { return -this.currentZ as NativeDistance; }
	protected get clampedDepth():NativeDistance { return -this.clampedZ as NativeDistance; }

	constructor(protected jobContext:JobContext) {
		this.minZ = this.decodeComplexAmount(this.jobContext.minZ);
		this.currentUnit = {[jobContext.nativeUnit.name]: {numerator:1, denominator:1}};
	}

	bitDiameterAtDepth(depth:number) {
		return this.decodeComplexAmount(this.jobContext.routerBit.diameterFunction({[this.jobContext.nativeUnit.name]: {numerator:depth, denominator:1}}));
	}

	protected transformVector(vec:ModelVector):NativePosition {
		return vectormath.transformVector(this.currentTransformation, vec) as NativePosition;
	}
	protected transformAndClampVector(vec:ModelVector, minZ=-Infinity):NativePosition {
		minZ = Math.max(minZ, this.minZ);
		const pos = this.transformVector(vec);
		return pos.z >= minZ ? pos : {x:pos.x, y:pos.y, z:minZ} as NativePosition;
	}
	protected transformHorizontalDistance(rad:ModelDistance):NativeDistance {
		return this.currentHorizontalScale * rad as NativeDistance;
	}
	protected transformVerticalDistance(rad:ModelDistance):NativeDistance {
		return this.currentVerticalScale * rad as NativeDistance;
	}
	forEachTransform(transforms:Transformish[], callback:()=>void ) {
		let oldTransform = this.currentTransformation;
		for( let t in transforms ) {
			this.currentTransformation = vectormath.multiplyTransform(oldTransform, toTransformationMatrix3D(transforms[t]));
			callback();
		}
		this.currentTransformation = oldTransform;
	}
	withTransform(xf:TransformationMatrix3D, callback:()=>void) {
		this.forEachTransform([xf], callback);
	}
	withCutUnit(unit:ComplexAmount|undefined, callback:()=>void) {
		if( unit == undefined ) {
			callback();
			return;
		}
		let scale = this.decodeComplexAmount(unit) / this.decodeComplexAmount(this.currentUnit);
		if( !isFinite(scale) ) {
			throw new Error("Switching base unit from "+formatComplexAmount(this.currentUnit)+" to "+formatComplexAmount(unit)+", which means scaling by "+scale.toFixed(4));
		}
		let oldUnit = this.currentUnit;
		this.currentUnit = unit;
		this.withTransform(vectormath.scaleToTransform(scale), callback);
		this.currentUnit = oldUnit;
	}
	withCutDepth(depth:number|undefined, callback:()=>void) {
		if( depth == Infinity ) depth = 99999 / this.currentHorizontalScale;
		if( depth == undefined || depth == 0 ) {
			callback();
			return;
		}
		else this.withTransform(vectormath.translationToTransform({x:0,y:0,z:-depth}), callback);
	}

	/*forEachOffset(offsets:Vector3D[], callback:()=>void ) {
		let oldTransform = this.transformation;
		for( let o in offsets ) {
			this.transformation = vectormath.multiplyTransform(oldTransform, vectormath.translationToTransform(offsets[o]));
			callback();
		}
		this.transformation = oldTransform;
	}*/
	decodeComplexAmount(ca:ComplexAmount):NativeDistance {
		return decodeComplexAmount(ca, this.jobContext.nativeUnit, distanceUnits) as NativeDistance;
	}

	abstract processPath(path:Path):void;
	abstract processCircle(diameter:ModelDistance):void;
	abstract processConicPocket(cp:ConicPocket):void;
	abstract processPause(p:Pause):void;

	processCut(cut:Cut) {
		if( cut.comment ) this.emitComment(cut.comment);
		switch(cut.classRef) {
		case "http://ns.nuke24.net/TTSGCG/Cut/Compound":
			return this.withCutUnit(cut.unit, () =>
				this.forEachTransform(cut.transformations, () => {
					for( let s in cut.components ) {
						this.processCut(cut.components[s]);
					}
				})
			);
		case "http://ns.nuke24.net/TTSGCG/Cut/TracePath":
			this.withCutDepth(cut.depth, () => this.processPath(cut.path));
			return;
		case "http://ns.nuke24.net/TTSGCG/Cut/RoundHole":
			this.withCutDepth(cut.depth, () => this.processCircle(cut.diameter as ModelDistance));
			return;
		case "http://ns.nuke24.net/TTSGCG/Cut/ConicPocket":
			this.processConicPocket(cut);
			return;
		case "http://ns.nuke24.net/TTSGCG/Cut/Pause":
			this.processPause(cut);
			return;
		}
		assertUnreachable(cut);
	}

	processJob(job:Job) {
		this.processCut(job.cut);
	}

	processJobs(jobs:Job[]) {
		for( let j in jobs ) this.processJob(jobs[j]);
	}
}

class BoundsFinder extends ShapeProcessorBase {
	public minX:number = Infinity;
	public minY:number = Infinity;
	public minZ:number = Infinity;
	public maxX:number = -Infinity;
	public maxY:number = -Infinity;
	public maxZ:number = -Infinity;

	emitComment(c:string):void {}

	processPoint(p:Vector3D):void {
		this.minX = Math.min(this.minX, p.x);
		this.minY = Math.min(this.minY, p.y);
		this.minZ = Math.min(this.minZ, p.z);
		this.maxX = Math.max(this.maxX, p.x);
		this.maxY = Math.max(this.maxY, p.y);
		this.maxZ = Math.max(this.maxZ, p.z);
	}
	processPath(path:Path):void {
		for( let s in path.segments ) {
			let seg = path.segments[s];
			this.processPoint(this.transformVector(path.vertexes[seg.startVertexIndex] as ModelVector));
			this.processPoint(this.transformVector(path.vertexes[seg.endVertexIndex] as ModelVector));
		}
	}
	processCircle(diameter:number) {
		let radius = diameter/2;
		let p = this.currentPosition;
		this.minX = Math.min(this.minX, p.x - radius);
		this.minY = Math.min(this.minY, p.y - radius);
		this.minZ = Math.min(this.minZ, p.z);
		this.maxX = Math.max(this.maxX, p.x + radius);
		this.maxY = Math.max(this.maxY, p.y + radius);
		this.maxZ = Math.max(this.maxZ, p.z);
	}
	processConicPocket(cp:ConicPocket) {
		this.processCircle(cp.diameter);
	}
	processPause(p:Pause) {}
}

type GCodeCommentMode = "none"|"parentheses"|"semicolon";
type StringEmitter = (s:string)=>unknown;

class GCodeGenerator extends ShapeProcessorBase {
	protected zoomHeight:NativeDistance;
	protected minimumFastZ:number;
	protected stepDown:NativeDistance;
	public commentMode:GCodeCommentMode = "parentheses";
	protected _position = {x:0, y:0, z:0};
	constructor(jobContext:JobContext, public emitter:StringEmitter) {
		super(jobContext);
		this.zoomHeight = this.decodeComplexAmount(inches(1, 4));
		this.minimumFastZ = this.decodeComplexAmount(inches(1, 16));
		this.stepDown = this.decodeComplexAmount(inches(2, 100));
	}
	emitLine(line:string):void {
		this.emitter(line+"\n");
	}
	emitBlankLine():void {
		this.emitLine("");
	}
	emitComment(c:string):void {
		switch(this.commentMode) {
		case "none": return;
		case "parentheses": return this.emitLine("("+c+")");
		case "semicolon": return this.emitLine("; "+c);
		}
		assertUnreachable(this.commentMode);
	}
	emitBlock(lines:string[]):void {
		for(let l in lines) this.emitter(lines[l]);
	}
	protected updatePosition(x:number|undefined, y:number|undefined, z:number|undefined):void {
		this._position = {
			x: x == undefined ? this._position.x : x,
			y: y == undefined ? this._position.y : y,
			z: z == undefined ? this._position.z : z,
		};
	}
	doMove(command:string, x:number|undefined, y:number|undefined, z:number|undefined=undefined) {
		if( x == undefined && y == undefined && z == undefined ) {
			this.emitComment("doMove with no x, y, or z!");
			return;
		}
		let line = command;
		if( x != undefined ) line += " X"+this.fmtDist(x);
		if( y != undefined ) line += " Y"+this.fmtDist(y);
		if( z != undefined ) line += " Z"+this.fmtDist(z);
		this.emitLine(line)
		this.updatePosition(x,y,z);
	}
	g00(x:number|undefined, y:number|undefined, z:number|undefined=undefined) {
		this.doMove("G00", x, y, z);
	}
	g01(x:number|undefined, y:number|undefined, z:number|undefined=undefined) {
		this.doMove("G01", x, y, z);
	}
	doCurve(command:string, x:number|undefined, y:number|undefined, z:number|undefined, i:number, j:number, k:number) {
		if( x == undefined && y == undefined && z == undefined ) {
			this.emitComment("doCurve with no x, y, or z!");
			return;
		}
		let line = command;
		line += " I"+this.fmtDist(i);
		line += " J"+this.fmtDist(j);
		line += " K"+this.fmtDist(k);
		if( x != undefined ) line += " X"+this.fmtDist(x);
		if( y != undefined ) line += " Y"+this.fmtDist(y);
		if( z != undefined ) line += " Z"+this.fmtDist(z);
		this.emitLine(line);
		this.updatePosition(x,y,z);
	}
	g02(x:number|undefined, y:number|undefined, z:number|undefined, i:number, j:number, k:number) {
		this.doCurve("G02",x,y,z,i,j,k);
	}
	g03(x:number|undefined, y:number|undefined, z:number|undefined, i:number, j:number, k:number) {
		this.doCurve("G03",x,y,z,i,j,k);
	}
	emitSetupCode():void {
		this.emitLine("G90");
		let speedInPerMinute = 3;
		if( this.jobContext.nativeUnit.name == "inch" ) {
			this.emitLine("G20");
			this.emitLine("F"+speedInPerMinute);
		} else if( this.jobContext.nativeUnit.name == "millimeter" ) {
			this.emitLine("G21");
			this.emitLine("F"+this.fmtDist(speedInPerMinute * 25.4));
		} else {
			throw new Error("GCodeGenerator can't handle native unit '"+this.jobContext.nativeUnit.name+"'");
		}
		this.emitLine("S1000");
		this.emitLine("M03");
		this.zoomToZoomHeight();
		this.emitBlankLine();
		this.emitComment("Bit tip diameter: "+formatComplexAmount(this.jobContext.routerBit.diameterFunction({})));
	}
	emitShutdownCode():void {
		this.emitBlankLine();
		this.emitComment("Job done!");
		this.zoomToZoomHeight();
		this.emitLine("M05");
	}
	zoomToZoomHeight():void {
		this.g00(undefined, undefined, this.zoomHeight);
	}
	protected zoomToNative(pos:NativePosition) {
		this.zoomToZoomHeight();
		this.g00(pos.x, pos.y);
		let minZoomZ = Math.max(this.minimumFastZ, pos.z);
		this.g00(undefined, undefined, minZoomZ);
		if( minZoomZ != pos.z ) {
			this.g01(undefined, undefined, pos.z);
		}
	}
	zoomToSurface(modelPos:ModelVector):void {
		this.zoomToNative(this.transformAndClampVector(modelPos, 0));
	}
	zoomTo(modelPos:ModelVector):void {
		this.zoomToNative(this.transformAndClampVector(modelPos));
	}
	carvePathSegment(path:Path, segmentIndex:number, direction:number):void {
		let segment = path.segments[segmentIndex];
		let startVertexIndex:number;
		let endVertexIndex:number;
		if( direction > 0 ) {
			startVertexIndex = segment.startVertexIndex;
			endVertexIndex   = segment.endVertexIndex;
		} else {
			startVertexIndex = segment.endVertexIndex;
			endVertexIndex   = segment.startVertexIndex;
		}
		let startVertex = this.transformVector(path.vertexes[startVertexIndex] as ModelVector);
		// TODO: Check that startVertex is where we already are???
		let endVertex = this.transformVector(path.vertexes[endVertexIndex] as ModelVector);
		// Theoretically path vertexes could have depth.  I'm ignoring that for now.
		if(segment.typeName == "StraightPathSegment") {
			this.g01(endVertex.x, endVertex.y);
		} else {
			let axisVertexIndex = segment.axisVertexIndex;
			if( axisVertexIndex == undefined ) {
				throw new Error("Undefined curve center vertex on path segment "+segmentIndex);
			}
			let curveCenterVertex = this.transformVector(path.vertexes[axisVertexIndex] as ModelVector);
			let i = curveCenterVertex.x - startVertex.x;
			let j = curveCenterVertex.y - startVertex.y;
			let k = curveCenterVertex.z - startVertex.z;
			let angle = direction * (segment.typeName == "CounterClockwisePathSegment" ? 1 : -1)
			this.doCurve(angle > 0 ? "G03" : "G02", endVertex.x, endVertex.y, undefined, i, j, k);
		}
	}
	processPath(path:Path):void {
		if(path.segments.length == 0) return;
		let targetZ = this.clampedZ;
		let seg0 = path.segments[0];
		let startPoint = path.vertexes[seg0.startVertexIndex];
		let currentZ = 0 - this.stepDown;
		let direction = 1;
		this.zoomToSurface(startPoint as ModelVector);
		while( currentZ > targetZ ) {
			this.emitComment("Step down to "+this.fmtDist(currentZ));
			this.g01(undefined, undefined, currentZ);
			let startPosition = this._position;
			let ssi0:number, ssi1:number, ssii:number;
			if( direction > 0 ) {
				ssi0 = 0;
				ssi1 = path.segments.length-1;
				ssii = 1; 
			} else {
				ssi0 = path.segments.length-1;
				ssi1 = 0;
				ssii = -1; 
			}
			for( let i=ssi0; ; i += ssii ) {
				this.carvePathSegment(path, i, direction);
				if( i == ssi1 ) break;
			}
			if( !vectormath.vectorsAreEqual(this._position, startPosition) ) {
				// Unless it's a loop, reverse for the next step!
				this.emitComment("Reversing because "+vectorToString(this._position)+" != "+vectorToString(startPosition));
				direction = -direction;
			} else {
				this.emitComment("Path closed!")
			}
			currentZ = Math.max(targetZ, currentZ - this.stepDown);
		}
		this.zoomToZoomHeight();
	}

	bangHole(depth:NativeDistance, stepDown:NativeDistance, stepUp:NativeDistance) {
		let currentZ = 0;
		let targetZ = 0 - depth;
		this.g01(undefined, undefined, currentZ); // If it's not already at the surface
		while( currentZ > targetZ ) {
			currentZ -= stepDown;
			this.g01(undefined, undefined, currentZ);
			this.g01(undefined, undefined, currentZ + stepUp);
		}
		this.g01(undefined, undefined, 0);
	}

	emitCircle(diameter:number) {
		let circleRadius = diameter/2;
		if( circleRadius <= 0 ) {
			this.emitComment(diameter + this.jobContext.nativeUnit.abbreviation + " hole will be a banger");
			this.zoomToSurface({x:0,y:0,z:0} as ModelVector);
			this.bangHole(this.clampedDepth, this.stepDown, this.stepDown/2 as NativeDistance);
		} else {
			this.emitComment(diameter + this.jobContext.nativeUnit.abbreviation + " hole will be circles");
			const path = circlePath(circleRadius/this.currentHorizontalScale);
			this.processPath(path);
		}
	}

	processCircle(diameter:ModelDistance) {
		this.emitCircle(this.transformHorizontalDistance(diameter as ModelDistance) - this.bitDiameterAtDepth(0));
	}

	processConicPocket(cp:ConicPocket) {
		let bitDiam = this.bitDiameterAtDepth(0);
		let teenth = this.decodeComplexAmount({"inch": {numerator:1, denominator:16}});
		let increment = Math.min(teenth, bitDiam/2);
		let origin:NativePosition = this.currentPosition;
		let topRad = this.transformHorizontalDistance(cp.diameter/2 as ModelDistance);
		let botRad = this.transformHorizontalDistance(cp.bottomDiameter/2 as ModelDistance);
		let botDepth = this.transformVerticalDistance(cp.bottomDepth as ModelDistance);
		let topDepth = this.transformVerticalDistance(cp.edgeDepth as ModelDistance);

		let slope = (botDepth - topDepth) / (topRad - botRad);
		
		this.emitComment("Need to carve cone from rad="+topRad+" to "+botRad+" in drad="+increment+" steps");
		let zoomed = false;
		for( let r:NativeDistance=topRad; r>=botRad; r = r - increment as NativeDistance) {
			let z = origin.z - (topDepth + slope * (topRad - r));
			if( z >= 0 ) continue;
			if( z < this.minZ ) z = this.minZ;
			if( !zoomed ) {
				this.zoomToNative({x:origin.x, y:origin.y - r, z} as NativePosition);
				zoomed = true;
			} else {
				this.g01(origin.x, origin.y - r, z);
			}
			this.g03(origin.x, origin.y - r, z, 0, r, 0);
		}
		this.emitComment("Done carving cone");
		if( cp.cutsBottom ) {
			throw new Error("cutsButtom not supported!");
		}
	}

	processPause(p:Pause) {
		this.emitLine("M00");
	}

	processJob(job:Job):void {
		this.emitBlankLine();
		this.emitComment("Job: "+job.name);
		super.processJob(job);
	}
}

function htmlEscape(text:string) {
	return text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#039;");
}

type SVGCutProcessingMode = "top"|"bottom";

class SVGGenerator extends ShapeProcessorBase {
	protected bottomColor = "black";
	protected cutColor = "gray";
	protected currentMode : SVGCutProcessingMode;

	emitComment(c:string):void {
		this.emitter("<!-- "+c+" -->\n");
	}

	// Updated as jobs/tasks are processed
	//protected strokeColor = "purple";
	//protected strokeWidth:number = 0;

	get strokeColor():string {
		if( this.currentMode == "top" ) return this.cutColor;
		else return this.bottomColor;
	}
	get strokeWidth():number {
		return this.bitDiameterAtDepth(this.currentMode == "bottom" ? 0 : this.clampedDepth);
	}

	constructor(jobContext:JobContext, public emitter:StringEmitter) {
		super(jobContext);
	}

	openElement(name:string, attrs:{[k:string]: string|number}={}, close:boolean=false) {
		this.emitter("<"+name);
		for( let k in attrs ) {
			let v = attrs[k];
			this.emitter(" "+k+"=\""+htmlEscape(""+v)+"\"");
		}
		if( close ) this.emitter("/>\n");
		else this.emitter(">");
	}
	closeElement(name:string) {
		this.emitter("</"+name+">");
	}

	processPath(path:Path) {
		let dParts:string[] = [];
		let vertexes = path.vertexes as ModelVector[];
		let started = false;
		let prevVertexIndex:number|undefined = undefined;
		for( let s in path.segments ) {
			let seg = path.segments[s];
			let startVertex = this.transformVector(vertexes[seg.startVertexIndex]);
			let endVertex = this.transformVector(vertexes[seg.endVertexIndex]);
			if( prevVertexIndex != seg.startVertexIndex ) {
				dParts.push("M"+startVertex.x+","+startVertex.y);
			}
			switch( seg.typeName ) {
			case "StraightPathSegment":
				dParts.push("L"+this.fmtDist(endVertex.x)+","+this.fmtDist(endVertex.y));
				break;
			case "ClockwisePathSegment": case "CounterClockwisePathSegment":
				let axisVertex = this.transformVector(vertexes[seg.axisVertexIndex]);
				let axisDx = axisVertex.x - startVertex.x;
				let axisDy = axisVertex.y - startVertex.y;
				let radius = Math.sqrt(axisDx*axisDx + axisDy*axisDy);
				// TODO: Need to take transformation into account to determine if it's clockwise or counterclockwise
				dParts.push(
					"A"+this.fmtDist(radius)+","+this.fmtDist(radius)+
					" 0 0 "+(seg.typeName == "ClockwisePathSegment" ? "0" : "1")+
					" "+this.fmtDist(endVertex.x)+","+this.fmtDist(endVertex.y)
				);
				break;
			}
			prevVertexIndex = seg.endVertexIndex;
		}
		this.openElement("path", {"fill": "none", "stroke-linecap": "round", "stroke-linejoin": "round", "stroke": this.strokeColor, "stroke-width": this.strokeWidth, "d": dParts.join(" ")}, true);
	}

	emitCircle(diameter:number) {
		let xfPos = this.currentPosition;
		this.openElement("circle", {
			cx: xfPos.x, cy: xfPos.y,
			r: diameter/2,
			fill: this.strokeColor,
			"stroke-width": 0,
		}, true);
	}

	processCircle(diameter:ModelDistance) {
		let extraDiam = 0;
		if(this.currentMode == "top") {
			extraDiam = this.bitDiameterAtDepth(this.clampedDepth) - this.bitDiameterAtDepth(0);
		}
		const circleDiameter = Math.max(this.transformHorizontalDistance(diameter), this.strokeWidth) + extraDiam;
		this.emitCircle(circleDiameter);
	}

	processConicPocket(cp:ConicPocket) {
		if( this.currentMode == "top" ) this.emitCircle(this.transformHorizontalDistance(cp.diameter as ModelDistance));
		else this.emitCircle(this.transformHorizontalDistance(cp.bottomDiameter as ModelDistance));
	}

	processJob(job:Job) {
		this.emitComment("Job: "+job.name+" ("+this.currentMode+")");
		super.processJob(job);
	}

	processPause(p:Pause) {}

	processJobs(jobs:Job[]):void {
		this.currentMode = "top";
		this.emitComment("Tops of cuts");
		super.processJobs(jobs);
		this.currentMode = "bottom";
		this.emitComment("Bottoms of cuts");
		super.processJobs(jobs);
	}

	emitHeader(modelBounds:{minX:number,minY:number,maxX:number,maxY:number}):void {
		const modelWidth = modelBounds.maxX - modelBounds.minX;
		const modelHeight = modelBounds.maxY - modelBounds.minY;
		this.emitter('<?xml version="1.0" standalone="no"?>\n');
		this.openElement("svg", {
			xmlns:"http://www.w3.org/2000/svg", version:"1.1",
			style: "width: "+modelWidth+this.jobContext.nativeUnit.abbreviation+"; height: "+modelHeight+this.jobContext.nativeUnit.abbreviation,
			viewBox:modelBounds.minX+" "+modelBounds.minY+" "+modelWidth+" "+modelHeight,
			transform:"scale(1,-1)"
		});
	}

	emitFooter():void {
		this.emitter("</svg>\n");
	}
}

type PanelAxis = "x"|"y";
type LatOrLong = "longitudinal"|"lateral";

interface TOGPanelOptions {
	length: number; // Width in inches
	cornerStyle: CornerStyleName;
	includeHoles: boolean;
	includeOutline: boolean;
	includeLabel: boolean;
	holeDiameter: number;
	holeSpacing: number;
	label: string|undefined;
	labelFontName: string;
	labelDepth: ComplexAmount;
	labelScale: number;
	labelDirection: LatOrLong;
}

/*
function makeTogPanelPart(options:TOGPanelOptions):Part {
	let holeX = 0.25;
	const labelFont = getFont(options.labelFontName);
	let holePositions = [];
	let firstHoleX = 0.25;
	let lastHoleX = options.length - 0.25;
	for( let x = firstHoleX; x <= lastHoleX; x += options.holeSpacing ) {
		holePositions.push({x, y:0.25, z:0});
	}
	for( let x = lastHoleX; x >= firstHoleX; x -= options.holeSpacing ) {
		holePositions.push({x, y:3.25, z:0});
	}
	let label = options.label || "";
	let labelShape = textToCut(label, labelFont);
	let cuts:Cut[] = [];
	let labelDepth = decodeComplexAmount(options.labelDepth,INCH);
	if( label.length > 0 && labelDepth > 0 ) {
		let textPlacementTransform:TransformationMatrix3D;
		if( options.labelDirection == "longitudinal" ) {
			textPlacementTransform = vectormath.translationToTransform({x:0.25, y:3 - options.labelScale/2, z:0});
		} else {
			textPlacementTransform = vectormath.multiplyTransform(
				vectormath.translationToTransform({x:options.length/2, y:0.5, z:0}),
				vectormath.xyzAxisAngleToTransform(0, 0, 1, quarterTurn)
			);
		}

		textPlacementTransform = [
			textPlacementTransform,
			vectormath.scaleToTransform(options.labelScale),
			vectormath.translationToTransform({x:0,y:0,z:-labelDepth})
		].reduce(vectormath.multiplyTransform);

		cuts.push({
			classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
			transformations: [textPlacementTransform],
			components: [labelShape]
		});
	}
	if( options.includeHoles ) {
		cuts.push({
			classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
			transformations: holePositions,
			components: [{
				classRef: "http://ns.nuke24.net/TTSGCG/Cut/RoundHole",
				diameter: options.holeDiameter,
				depth: Infinity,
			}]
		});
	}
	if( options.includeOutline ) {
		tasks.push({
			typeName: "PathCarveTask",
			shapeUnit: inches(1),
			depth: throughDepth,
			cuts: [
				boxPath({
					x0: 0, y0: 0,
					width: options.length, height: 3.5,
					cornerOptions: { cornerRadius: 0.25, cornerStyleName: "Round" },
				})
			]
		});
	}
	return {
		name: "TOGPanel",
		cut: {
			classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
			unit: inches(1),
			transformations: identityTransformations,
			components: cuts
		}
	};
}
*/

function parseNumber(numStr:string):number {
	let rn = rational.parse(numStr);
	return rn.numerator / rn.denominator;
}

function makeVBit(degrees:number, pointSize:ComplexAmount):RouterBit {
	const twiceSlope = Math.tan(degrees/2 * Math.PI/180);
	const pointSizeMm = decodeComplexAmount(pointSize, MM, distanceUnits);
	return {
		name: (pointSizeMm > 0 ? pointSize + "in-tip " : "") + degrees+"-degree carving bit",
		diameterFunction: (depth) => addComplexAmounts(pointSize, scaleComplexAmount(depth, {numerator:twiceSlope, denominator:1})),
	}
}

function transformCut(xf:TransformationMatrix3D, cut:Cut):Cut {
	return {
		classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
		transformations: [xf],
		components: [cut]
	}
}

function translateCut(offset:Vector3D, shape:Cut, ):Cut {
	return transformCut(vectormath.translationToTransform(offset), shape)
}

// Parts for router:
// WSTYPE-200027 = over thingy
// WSTYPE-200028 = under thingy
// WSTYPE-200029 = better under thingy
// WSTYPE-200030 = a panel for connecting TOGRack rails to 12" gridrack rails
// WSTYPE-200031 = 200029 but with M4 holes
/*
function makePart200027Tasks():Task[] {
	// 1cm wide
	// 40cm tall
	// stickey outey part (1.5cm wide) in middle 2cm
	// Center line would be at y = 2dm
	const panelThickness = 1/8; // inches
	const mountingHoleSpacing = 9.5; // mm
	let pb:PathBuilder = new PathBuilder({x:0,y:0,z:0});
	pb.lineTo({x:10,y: 0,z:0}).lineTo({x:10,y: 0,z:0}).lineTo({x:10,y:10,z:0})
	  .lineTo({x:15,y:10,z:0}).lineTo({x:15,y:30,z:0}).lineTo({x:10,y:30,z:0})
	  .lineTo({x:10,y:40,z:0}).lineTo({x: 0,y:40,z:0}).closeLoop();
	let pokeyHolePositions:Vector3D[] = [];
	for( let phRow=0; phRow<=1; ++phRow ) {
		for( let phX=1.5; phX<15; phX += 2 ) {
			pokeyHolePositions.push({x:phX, y:20+(phRow-0.5)*mountingHoleSpacing, z:0})
		}
	}
	return [
		{
			typeName: "PathCarveTask",
			depth: millimeters(1),
			shapeUnit: millimeters(1),
			cuts: [
				shapeMmToInch({
					typeName: "Points",
					positions: pokeyHolePositions
				}),
			]
		},
		{
			typeName: "PathCarveTask",
			depth: throughDepth,
			shapeUnit: millimeters(1),
			cuts: [shapeMmToInch(pb.path)]
		}
	];
}

function makePart200028Tasks():Task[] {
	const panelWidth = 20;
	const panelLength = 30;
	const mountingHoleSpacing = 9.5;
	let pokeyHolePositions:Vector3D[] = [];
	for( let phRow=0; phRow<=1; ++phRow ) {
		for( let phY=2; phY < panelLength; phY += 2) {
			pokeyHolePositions.push({x:panelWidth/2 + (phRow-0.5)*mountingHoleSpacing, y:phY, z:0})
		}
	}
	return [
		{
			typeName: "PathCarveTask",
			depth: millimeters(1),
			shapeUnit: millimeters(1),
			cuts: [
				{
					typeName: "Points",
					positions: pokeyHolePositions
				},
			]
		},
		{
			typeName: "PathCarveTask",
			depth: throughDepth,
			shapeUnit: millimeters(1),
			cuts: [
				boxPath({
					cx: panelWidth/2,
					cy: panelLength/2,
					width: 8,
					height: panelLength - 10,
					cornerOptions: {
						cornerRadius: 4,
						cornerStyleName: "Round"
					}
				}),
				boxPath({
					x0: 0, y0: 0,
					width: panelWidth,
					height: panelLength,
					cornerOptions: {
						cornerRadius: 3,
						cornerStyleName: "Round"
					}
				})
			]
		}
	];
}

function makePart200029Tasks():Task[] {
	const panelWidth = 20;
	const panelHeight = 60;
	const mountingHoleSpacing = 9.5;
	let pokeyHolePositions:Vector3D[] = [];
	for( let phRow=0; phRow<=1; ++phRow ) {
		for( let phX=2; phX < panelWidth; phX += 2) {
			pokeyHolePositions.push({x:phX, y:panelHeight/2 + (phRow-0.5)*mountingHoleSpacing, z:0})
		}
	}
	return [
		{
			typeName: "PathCarveTask",
			depth: millimeters(1),
			shapeUnit: millimeters(1),
			cuts: [
				{
					typeName: "Points",
					positions: pokeyHolePositions
				},
			]
		},
		{
			typeName: "PathCarveTask",
			depth: throughDepth,
			shapeUnit: millimeters(1),
			cuts: [
				boxPath({
					cx: panelWidth/2,
					cy: 10,
					width: panelWidth - 10,
					height: 8,
					cornerOptions: {
						cornerRadius: 4,
						cornerStyleName: "Round"
					}
				}),
				boxPath({
					cx: panelWidth/2,
					cy: 50,
					width: panelWidth - 10,
					height: 8,
					cornerOptions: {
						cornerRadius: 4,
						cornerStyleName: "Round"
					}
				}),
				boxPath({
					x0: 0, y0: 0,
					width: panelWidth,
					height: panelHeight,
					cornerOptions: {
						cornerRadius: 3,
						cornerStyleName: "Round"
					}
				})
			]
		}
	];
}
*/

interface JobProcessor {
	processJobs(jobs:Job[]):void;
}

import makeWstype200030 from './parts/wstype200030';
import makeWstype200031 from './parts/wstype200031';
import { flatheadNumberSixHole } from './parts/countersinktest';
import { Path } from './Shape2D';
import Part from './Part';
import { type } from 'os';
import Unit, { findUnit, UnitTable, getUnit } from './Unit';
import { distanceUnits, inches, MM, millimeters } from './units';
import { open, fstat, createWriteStream, WriteStream } from 'fs';
import { Writable } from 'stream';
import StandardPartOptions from './parts/StandardPartOptions';

type OutputFormatID = "svg"|"gcode"|"bounds";

if( require.main == module ) {
	let variationString : "full"|"sketch"|string = "full"; // Some parts support this parameter
	let includeOutline = true;
	let includeHoles = true;
	let includeLabel = true;
	let label = "TTSGCG";
	let labelFontName = "tog-block-letters";
	let bitTipSize = inches(0.01);
	let bitAngle = 11;
	let workpieceThickness:ComplexAmount|undefined = undefined;
	let holeDiameter = 5/32;
	let sketchDepth = millimeters(1);
	let labelDepth = millimeters(1);
	let holeSpacing = 1/4; // Usually 1/2 is sufficient but why not do even better?!
	let labelScale = 2.5/6; // Fits "TTSGCG" into 2.5 inches :P
	let length = 1;
	let labelDirection:LatOrLong = "lateral";

	let outputFiles:{[filename:string]: OutputFormatID} = {};
	let padding:ComplexAmount = inches(0.5);
	let offset:Vector3D = {x:0, y:0, z:0};
	let rotation:number = 0;
	let nativeUnit:Unit = MM;
	let gCodeCommentMode:GCodeCommentMode = "none";

	const makeBit = function() {
		return makeVBit(bitAngle, bitTipSize);
	}

	const getTransformation = function():TransformationMatrix3D {
		return vectormath.multiplyTransform(
			vectormath.translationToTransform(offset),
			vectormath.xyzAxisAngleToTransform(0, 0, -1, rotation*Math.PI/180)
		);
	}

	const cutToJob = function(name:string, cut:Cut):Job {
		return {
			name: name,
			cut: {
				classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
				transformations: [getTransformation()],
				components: [cut],
			}
		}
	}

	const partToJob = function(part:Part, transform:TransformationMatrix3D):Job {
		return {
			name: part.name,
			cut: {
				classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
				transformations: [transform],
				components: [part.cut],
			}
		}
	}

	const empty = function(s:string|undefined):boolean {
		return s == undefined || s.length == 0;
	}

	const jobPromises:Promise<Job>[] = [];

	for( let i=2; i<process.argv.length; ++i ) {
		let m;
		let arg = process.argv[i];
		if( arg == "--no-outline" ) {
			includeOutline = false;
		} else if( arg == "--no-holes" ) {
			includeHoles = false;
		} else if( arg == '--holes-only' ) {
			includeHoles = true;
			includeOutline = false;
			includeLabel = false;
		} else if( arg == '--outline-only' ) {
			includeHoles = false;
			includeOutline = true;
			includeLabel = false;
		} else if( arg == '--sketch' ) {
			variationString = "sketch";
		} else if( (m = /--sketch-depth=(.*)/.exec(arg)) ) {
			sketchDepth = parseComplexAmount(m[1], distanceUnits);
		} else if( arg == '--label-only' ) {
			includeHoles = false;
			includeOutline = false;
			includeLabel = true;
		} else if( (m = /^--variation=(.*)/.exec(arg)) ) {
			variationString = m[1];
		} else if( (m = /^--offset=([^,]*),([^,]*),([^,]*)$/.exec(arg)) ) {
			offset = {x:offset.x, y:offset.y, z:offset.z};
			console.error("Warning: --offset doesn't know about units (which should be fixed someday)");
			console.error("  Specify --native-unit first, and offset will be interpreted as that");
			if( !empty(m[1]) ) offset.x = parseNumber(m[1]);
			if( !empty(m[2]) ) offset.y = parseNumber(m[2]);
			if( !empty(m[3]) ) offset.z = parseNumber(m[3]);
		} else if( (m = /^--rotation=(.*)$/.exec(arg)) ) {
			rotation = +m[1];
		} else if( (m = /^--native-unit=(.*)$/.exec(arg)) ) {
			nativeUnit = getUnit(m[1], distanceUnits);
		} else if( (m = /^--thickness=(.*)$/.exec(arg)) ) {
			workpieceThickness = parseComplexAmount(m[1], distanceUnits);
		} else if( (m = /^--label=(.*)$/.exec(arg)) ) {
			label = m[1];
		} else if( (m = /^--label-font=(.*)$/.exec(arg)) ) {
			labelFontName = m[1];
		} else if( (m = /^--label-direction=(longitudinal|lateral)$/.exec(arg)) ) {
			labelDirection = <LatOrLong>m[1];
		} else if( (m = /^--label-depth=(.*)$/.exec(arg)) ) {
			labelDepth = parseComplexAmount(m[1], distanceUnits);
		} else if( (m = /^--bit-diameter=(.+)$/.exec(arg)) ) {
			bitTipSize = parseComplexAmount(m[1], distanceUnits);
		} else if( (m = /^--bit-angle=(.+)$/.exec(arg)) ) {
			bitAngle = parseNumber(m[1]);
		} else if( (m = /^--padding=(.*)$/.exec(arg)) ) {
			padding = parseComplexAmount(m[1], distanceUnits);
		} else if( arg == "--output-bounds" ) {
			outputFiles["-"] = "bounds";
		} else if( (m = /^--gcode-comment-mode=(none|semicolon|parentheses)$/.exec(arg)) ) {
			gCodeCommentMode = (m[1] as GCodeCommentMode)
		} else if( arg == "--output-gcode" ) {
			outputFiles["-"] = "gcode";
		} else if( (m = /^--output-gcode=(.*)$/.exec(arg))) {
			outputFiles[m[1]] = "gcode";
		} else if( arg == "--output-svg" ) {
			outputFiles["-"] = "svg";
		} else if( (m = /^--output-svg=(.*)$/.exec(arg))) {
			outputFiles[m[1]] = "svg";
		/*
		} else if( arg == '--tog-panel' ) {
			jobs.push({
				name: "TOGPanel",
				transformation: getTransformation(),
				tasks: makeTogPanelTasks({
					cornerStyle: "Round",
					includeHoles,
					includeOutline,
					includeLabel,
					holeDiameter,
					labelFontName,
					holeSpacing,
					length,
					label,
					labelDepth,
					labelScale,
					labelDirection,
				})
			});
		} else if( arg == '--wstype-200027' ) {
			jobs.push({
				name: "WSTYPE-200027",
				transformation: getTransformation(),
				tasks: makePart200027Tasks()
			});
		} else if( arg == '--wstype-200028' ) {
			jobs.push({
				name: "WSTYPE-200028",
				transformation: getTransformation(),
				tasks: makePart200028Tasks()
			});
		} else if( arg == '--wstype-200029' ) {
			jobs.push({
				name: "WSTYPE-200028",
				transformation: getTransformation(),
				tasks: makePart200029Tasks()
			});
		*/
		} else if( arg == '--wstype-200030' ) {
			jobPromises.push(Promise.resolve(partToJob(makeWstype200030(), getTransformation())));
		} else if( arg == '--wstype-200031' ) {
			jobPromises.push(Promise.resolve(partToJob(makeWstype200031(), getTransformation())));
		} else if( arg == '--test-countersink' ) {
			jobPromises.push(Promise.resolve(cutToJob("Test countersink", flatheadNumberSixHole)));
		} else if( (m = /--part=(.*)$/.exec(arg)) ) {
			const currentTransform = getTransformation();
			const currentParams:StandardPartOptions = {
				labelText: label,
				labelDepth: labelDepth,
				sketchDepth: sketchDepth,
				variationString,
			};
			// TODO: Use dynamic imports to load the part
			jobPromises.push(
				import("./parts/"+m[1]+".js").then((mod) => {
					return partToJob(mod.default(currentParams), currentTransform);
				})
			);
			//jobs.push(partToJob(makeWstype200030()));
		} else {
			console.error("Unrecognized argument: "+arg);
			process.exit(1);
		}
	}

	if( workpieceThickness == undefined ) {
		throw new Error("Please indicate your workpiece --thickness=...");
	}

	const jobContext:JobContext = {
		nativeUnit,
		minZ: scaleComplexAmount(workpieceThickness, -1),
		routerBit: makeBit(),
	};

	let bf = new BoundsFinder(jobContext);
	Promise.all(jobPromises).then( (jobs:Job[]) => {
		bf.processJobs(jobs);
		let outputPromises:Promise<unknown>[] = [];
		for( let f in outputFiles ) {
			const outputMode = outputFiles[f];
			outputPromises.push(new Promise<Writable>((resolve,reject) => {
				if( f == "-" ) {
					resolve(process.stdout);
					return;
				}
				open(f, "w", (err:Error,fd:number) => {
					if( err ) reject(err);
					else resolve(createWriteStream(f, {encoding:"utf-8", fd}));
				});
			}).then( (outputStream:WriteStream) => {
				const emitter:StringEmitter = (s:string) => outputStream.write(s);
				switch( outputMode ) {
					case "bounds":
						outputStream.write("x: "+bf.minX +".."+bf.maxX);
						outputStream.write("y: "+bf.minY +".."+bf.maxY);
						outputStream.write("z: "+bf.minZ +".."+bf.maxZ);
						break;
					case "gcode":
						let gcg = new GCodeGenerator(jobContext, emitter);
						gcg.commentMode = gCodeCommentMode;
						gcg.emitSetupCode();
						gcg.processJobs(jobs);
						gcg.emitShutdownCode();
						break;
					case "svg":
						let padded = aabb.pad(bf, decodeComplexAmount(padding, nativeUnit, distanceUnits));
						let sg = new SVGGenerator(jobContext, emitter);
						sg.emitHeader(padded);
						sg.processJobs(jobs);
						sg.emitFooter();
						break;
					}
				}
			));
		}
		return Promise.all(outputPromises);
	}).catch( (error:Error) => {
		console.error(error.stack);
		process.exitCode = 1;
	});
}
