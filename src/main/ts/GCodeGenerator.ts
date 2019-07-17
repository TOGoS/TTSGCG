import * as aabb from './aabb';
import { AABB3D } from './aabb';
import * as vectormath from './vectormath';
import { TransformationMatrix3D, Vector3D, zeroVector } from './vectormath';

import Cut, { identityTransformations } from './Cut';
import { CornerStyleName, PathBuilder, boxPath, circlePath, quarterTurn } from './pathutils';
import { textToCut } from './text';
import { getFont } from './fonts';
import { decode } from 'punycode';
import RationalNumber, { multiplyRationals, parseRationalNumber, addRationals, toRationalNumber } from './RationalNumber';
import ComplexAmount, { decodeComplexAmount, addComplexAmounts, scaleComplexAmount, parseComplexAmount, formatComplexAmount } from './ComplexAmount';
import Transformish, { toTransformationMatrix3D } from './Transformish';

function vectorToString(v:Vector3D, digits=4):string {
	return "<"+v.x.toFixed(digits)+","+v.y.toFixed(digits)+","+v.z.toFixed(digits)+">";
}

////

const INCH : Unit = {
	unitValue: {numerator:254, denominator:10},
	name: "inch",
	abbreviation: "in",
	aliases: ["inch", "in", '"', "inch", "inches"],
};

const MM : Unit = {
	unitValue: toRationalNumber(1),
	name: "millimeter",
	abbreviation: "mm",
	aliases: ["millimeter", "mm", "millimeters"],
};

const distanceUnits:{[k:string]:Unit} = {
	"inch": INCH,
	"millimeter": MM,
}

type DistanceUnitName = "inch"|"millimeter"|"board";

const throughDepth:ComplexAmount = {"board":{numerator:1,denominator:1}};

function amount(unitName:string, numerator:number, denominator:number=1):ComplexAmount {
	return { [unitName]: {numerator, denominator} };
}
function inches(numerator:number, denominator:number=1):ComplexAmount {
	return amount("inch", numerator, denominator);
}
function millimeters(numerator:number, denominator:number=1):ComplexAmount {
	return amount("millimeter", numerator, denominator);
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
	throw new Error("Shouldn't've made it here");
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
	protected currentScale:number = 1;
	protected currentUnit:ComplexAmount;
	protected get currentZ() { return this.currentVector.z; }
	protected get clampedZ() { return Math.max(this.minZ, this.currentVector.z); }
	protected get currentDepth() { return -this.currentZ; }
	protected get clampedDepth() { return -this.clampedZ; }
	protected get currentVector():Vector3D {
		return vectormath.transformVector(this.currentTransformation, zeroVector);
	}

	constructor(protected jobContext:JobContext) {
		this.minZ = this.decodeComplexAmount(this.jobContext.minZ);
		this.currentUnit = {[jobContext.nativeUnit.name]: {numerator:1, denominator:1}};
	}

	protected transformVector(vec:Vector3D):Vector3D {
		return vectormath.transformVector(this.currentTransformation, vec);
	}
	protected transformAndClampVector(vec:Vector3D):Vector3D {
		vec = this.transformVector(vec);
		return vec.z >= this.minZ ? vec : {x:vec.x, y:vec.y, z:this.minZ};
	}
	forEachTransform(transforms:Transformish[], callback:()=>void ) {
		let oldTransform = this.currentTransformation;
		let oldScale = this.currentScale;
		for( let t in transforms ) {
			this.currentTransformation = vectormath.multiplyTransform(oldTransform, toTransformationMatrix3D(transforms[t]));
			this.currentScale = Math.max(this.currentTransformation.xx, this.currentTransformation.xy, this.currentTransformation.xz);
			callback();
		}
		this.currentTransformation = oldTransform;
		this.currentScale = oldScale;
	}
	withTransform(xf:TransformationMatrix3D, callback:()=>void) {
		this.forEachTransform([xf], callback);
	}
	withShapeUnit(unit:ComplexAmount|undefined, callback:()=>void) {
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
	withDepth(depth:number|undefined, callback:()=>void) {
		if( depth == Infinity ) depth = this.currentZ - this.minZ;
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
	decodeComplexAmount(ca:ComplexAmount):number {
		return decodeComplexAmount(ca, this.jobContext.nativeUnit, distanceUnits);
	}

	abstract processPath(path:Path):void;
	abstract processCircle(diameter:number):void;

	processCut(cut:Cut) {
		switch(cut.classRef) {
		case "http://ns.nuke24.net/TTSGCG/Cut/Compound":
			return this.withShapeUnit(cut.unit, () =>
				this.forEachTransform(cut.transformations, () => {
					for( let s in cut.components ) {
						this.processCut(cut.components[s]);
					}
				})
			);
		case "http://ns.nuke24.net/TTSGCG/Cut/TracePath":
			this.withDepth(cut.depth, () => this.processPath(cut.path));
			return;
		case "http://ns.nuke24.net/TTSGCG/Cut/RoundHole":
			this.withDepth(cut.depth, () => this.processCircle(cut.diameter));
			return;
		case "http://ns.nuke24.net/TTSGCG/Cut/ConicPocket":
			this.processCircle(cut.diameter);
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
			this.processPoint(this.transformVector(path.vertexes[seg.startVertexIndex]));
			this.processPoint(this.transformVector(path.vertexes[seg.endVertexIndex]));
		}
	}
	processCircle(diameter:number) {
		let radius = diameter/2;
		let p = this.transformVector(zeroVector);
		this.minX = Math.min(this.minX, p.x - radius);
		this.minY = Math.min(this.minY, p.y - radius);
		this.minZ = Math.min(this.minZ, p.z);
		this.maxX = Math.max(this.maxX, p.x + radius);
		this.maxY = Math.max(this.maxY, p.y + radius);
		this.maxZ = Math.max(this.maxZ, p.z);
	}
}

type GCodeCommentMode = "none"|"parentheses"|"semicolon";

class GCodeGenerator extends ShapeProcessorBase {
	public emitter:(s:string)=>string;
	protected zoomHeight:number;
	protected minimumFastZ:number;
	protected stepDown:number;
	public commentMode:GCodeCommentMode = "parentheses";
	protected _position = {x:0, y:0, z:0};
	constructor(jobContext:JobContext) {
		super(jobContext);
		this.emitter = console.log.bind(console);
		this.zoomHeight = this.decodeComplexAmount(inches(1/4));
		this.minimumFastZ = this.decodeComplexAmount(inches(1/16));
		this.stepDown = this.decodeComplexAmount(inches(0.02));
	}
	emit(line:string):void {
		this.emitter(line);
	}
	emitBlankLine():void {
		this.emit("");
	}
	emitComment(c:string):void {
		switch(this.commentMode) {
		case "none": return;
		case "parentheses": return this.emit("("+c+")");
		case "semicolon": return this.emit("; "+c);
		}
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
		this.emit(line)
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
		this.emit(line);
		this.updatePosition(x,y,z);
	}
	g02(x:number|undefined, y:number|undefined, z:number|undefined, i:number, j:number, k:number) {
		this.doCurve("G02",x,y,z,i,j,k);
	}
	g03(x:number|undefined, y:number|undefined, z:number|undefined, i:number, j:number, k:number) {
		this.doCurve("G03",x,y,z,i,j,k);
	}
	emitSetupCode():void {
		this.emit("G90");
		if( this.jobContext.nativeUnit.name == "inch" ) {
			this.emit("G20");
		} else if( this.jobContext.nativeUnit.name == "millimeter" ) {
			this.emit("G21");
		} else {
			throw new Error("GCodeGenerator can't handle native unit '"+this.jobContext.nativeUnit.name+"'");
		}
		this.emit("F3");
		this.emit("S1000");
		this.emit("M03");
		this.zoomToZoomHeight();
		this.emitBlankLine();
	}
	emitShutdownCode():void {
		this.emitBlankLine();
		this.emitComment("Job done!");
		this.zoomToZoomHeight();
		this.emit("M05");
	}
	zoomToZoomHeight():void {
		this.g00(undefined, undefined, this.zoomHeight);
	}
	zoomTo(position:Vector3D):void {
		this.zoomToZoomHeight();
		position = this.transformAndClampVector(position);
		this.g00(position.x, position.y);
		let minZoomZ = Math.max(this.minimumFastZ, position.z);
		this.g00(undefined, undefined, minZoomZ);
		if( minZoomZ != position.z ) {
			this.g01(undefined, undefined, position.z);
		}
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
		let startVertex = this.transformVector(path.vertexes[startVertexIndex]);
		// TODO: Check that startVertex is where we already are???
		let endVertex = this.transformVector(path.vertexes[endVertexIndex]);
		// Theoretically path vertexes could have depth.  I'm ignoring that for now.
		if(segment.typeName == "StraightPathSegment") {
			this.g01(endVertex.x, endVertex.y);
		} else {
			let axisVertexIndex = segment.axisVertexIndex;
			if( axisVertexIndex == undefined ) {
				throw new Error("Undefined curve center vertex on path segment "+segmentIndex);
			}
			let curveCenterVertex = this.transformVector(path.vertexes[axisVertexIndex]);
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
		this.zoomTo(startPoint);
		let currentZ = 0;
		let direction = 1;
		while( currentZ > targetZ ) {
			currentZ = Math.max(targetZ, currentZ - this.stepDown);
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
		}
		this.zoomToZoomHeight();
	}

	bangHole(depth:number, stepDown:number, stepUp:number) {
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

	processCircle(diameter:number) {
		let bitRadius = this.decodeComplexAmount(this.jobContext.routerBit.diameterFunction({}))/2
		let circleRadius = this.currentScale * diameter/2 - bitRadius;
		if( circleRadius <= 0 ) {
			this.emitComment(diameter + this.jobContext.nativeUnit.abbreviation + " hole will be a banger");
			this.zoomTo({x:0,y:0,z:0});
			this.bangHole(this.clampedDepth, this.stepDown, this.stepDown/2);
		} else {
			this.emitComment(diameter + this.jobContext.nativeUnit.abbreviation + " hole will be circles");
			const path = circlePath(circleRadius/this.currentScale);
			this.processPath(path);
		}
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
	public emitter:(s:string)=>string;
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
		let depth = {[this.jobContext.nativeUnit.name]: {numerator:this.clampedDepth, denominator:1}};
		return this.decodeComplexAmount(this.jobContext.routerBit.diameterFunction(depth));
	}

	constructor(jobContext:JobContext) {
		super(jobContext);
		this.emitter = console.log.bind(console);
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
		let started = false;
		let prevVertexIndex:number|undefined = undefined;
		for( let s in path.segments ) {
			let seg = path.segments[s];
			let startVertex = this.transformVector(path.vertexes[seg.startVertexIndex]);
			let endVertex = this.transformVector(path.vertexes[seg.endVertexIndex]);
			if( prevVertexIndex != seg.startVertexIndex ) {
				dParts.push("M"+startVertex.x+","+startVertex.y);
			}
			switch( seg.typeName ) {
			case "StraightPathSegment":
				dParts.push("L"+this.fmtDist(endVertex.x)+","+this.fmtDist(endVertex.y));
				break;
			case "ClockwisePathSegment": case "CounterClockwisePathSegment":
				let axisVertex = this.transformVector(path.vertexes[seg.axisVertexIndex]);
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

	processCircle(diameter:number) {
		let fill:string;
		let stroke:string;
		const tipWidth = this.decodeComplexAmount(this.jobContext.routerBit.diameterFunction({}));
		const extraDiam = this.strokeWidth - tipWidth;
		const bottomDiameter = Math.max(this.currentScale * diameter, tipWidth);
		const circleRadius = (bottomDiameter + extraDiam)/2;
		let xfPos = this.currentVector;
		this.openElement("circle", {
			cx: xfPos.x, cy: xfPos.y,
			r: circleRadius,
			fill: this.strokeColor,
			"stroke-width": 0,
		}, true);
	}

	set xxcurrentMode(mode:"EmitTopCut"|"EmitBottomCut") {
		
		const cutBottomWidth = this.decodeComplexAmount(this.jobContext.routerBit.diameterFunction({}));
	}
	processJob(job:Job) {
		this.emitComment("Job: "+job.name);
		super.processJob(job);
	}

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
	let rn = parseRationalNumber(numStr);
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

import makeWstype200030 from './parts/WSTYPE-200030';
import { Path } from './Shape2D';
import Part from './Part';
import { type } from 'os';
import Unit, { findUnit, UnitTable, getUnit } from './Unit';

if( require.main == module ) {
	let jobs:Job[] = [];
	let includeOutline = true;
	let includeHoles = true;
	let includeLabel = true;
	let label = "TTSGCG";
	let labelFontName = "tog-block-letters";
	let bitTipSize = inches(0.05);
	let bitAngle = 30;
	let workpieceThickness = inches(1, 8);
	let holeDiameter = 5/32;
	let labelDepth = millimeters(1);
	let holeSpacing = 1/4; // Usually 1/2 is sufficient but why not do even better?!
	let labelScale = 2.5/6; // Fits "TTSGCG" into 2.5 inches :P
	let length = 1;
	let labelDirection:LatOrLong = "lateral";
	let outputMode:"svg"|"gcode"|"bounds" = "gcode";
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

	const partToJob = function(part:Part):Job {
		return {
			name: part.name,
			cut: {
				classRef: "http://ns.nuke24.net/TTSGCG/Cut/Compound",
				transformations: [getTransformation()],
				components: [part.cut],
			}
		}
		partToJob
	}

	const empty = function(s:string|undefined):boolean {
		return s == undefined || s.length == 0;
	}

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
		} else if( arg == '--label-only' ) {
			includeHoles = false;
			includeOutline = false;
			includeLabel = true;
		} else if( (m = /^--offset=([^,]*),([^,]*),([^,]*)$/.exec(arg)) ) {
			offset = {x:offset.x, y:offset.y, z:offset.z};
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
		} else if( (m = /^--bit-diameter=(.+)$/.exec(arg)) ) {
			bitTipSize = parseComplexAmount(m[1], distanceUnits);
		} else if( (m = /^--bit-angle=(.+)$/.exec(arg)) ) {
			bitAngle = parseNumber(m[1]);
		} else if( (m = /^--padding=(.*)$/.exec(arg)) ) {
			padding = parseComplexAmount(m[1], distanceUnits);
		} else if( arg == "--output-bounds" ) {
			outputMode = "bounds";
		} else if( arg == "--output-gcode" ) {
			outputMode = "gcode";
		} else if( (m = /^--gcode-comment-mode=(None|Semicolon|Parentheses)/.exec(arg)) ) {
			gCodeCommentMode = (m[2] as GCodeCommentMode)
		} else if( arg == "--output-svg" ) {
			outputMode = "svg";
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
			jobs.push(partToJob(makeWstype200030()));
		} else {
			console.error("Unrecognized argument: "+arg);
			process.exit(1);
		}
	}

	const jobContext:JobContext = {
		nativeUnit,
		minZ: scaleComplexAmount(workpieceThickness, -1),
		routerBit: makeBit(),
	};

	let bf = new BoundsFinder(jobContext);
	bf.processJobs(jobs);

	switch( outputMode ) {
	case "bounds":
		console.log("x: "+bf.minX +".."+bf.maxX);
		console.log("y: "+bf.minY +".."+bf.maxY);
		console.log("z: "+bf.minZ +".."+bf.maxZ);
		break;
	case "gcode":
		let gcg = new GCodeGenerator(jobContext);
		gcg.commentMode = gCodeCommentMode;
		gcg.emitSetupCode();
		gcg.processJobs(jobs);
		gcg.emitShutdownCode();
		break;
	case "svg":
		let padded = aabb.pad(bf, decodeComplexAmount(padding, nativeUnit, distanceUnits));
		let sg = new SVGGenerator(jobContext);
		sg.emitHeader(padded);
		sg.processJobs(jobs);
		sg.emitFooter();
		break;
	}
}
