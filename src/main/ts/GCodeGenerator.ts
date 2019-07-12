import * as aabb from './aabb';
import { AABB3D } from './aabb';
import * as vectormath from './vectormath';
import { TransformationMatrix3D, Vector3D } from './vectormath';

import { Shape, Path, PathSegment } from './shapes';
import { CornerStyleName, PathBuilder, boxPath, circlePath, quarterTurn } from './pathutils';
import { textToShape } from './text';
import { getFont } from './fonts';
import { decode } from 'punycode';

function vectorToString(v:Vector3D, digits=4):string {
	return "<"+v.x.toFixed(digits)+","+v.y.toFixed(digits)+","+v.z.toFixed(digits)+">";
}

////

interface DistanceUnit {
	unitValueInMm : number;
	name : string;
	abbreviation : string;
	aliases : string[];
};

const INCH : DistanceUnit = {
	unitValueInMm: 25.4,
	name: "inch",
	abbreviation: "in",
	aliases: ["inch", "in", '"', "inch", "inches"],
};

const MM : DistanceUnit = {
	unitValueInMm: 1,
	name: "millimeter",
	abbreviation: "mm",
	aliases: ["millimeter", "mm", "millimeters"],
};

const distanceUnits:{[k:string]:DistanceUnit} = {
	"inch": INCH,
	"millimeter": MM,
}

function findDistanceUnit(name:string):DistanceUnit|undefined {
	for( let du in distanceUnits ) {
		let distanceUnit = distanceUnits[du];
		for( let a in distanceUnit.aliases ) {
			if( distanceUnit.aliases[a] == name ) return distanceUnit;
		}
	}
	return undefined;
}

function getDistanceUnit(name:string):DistanceUnit {
	let u = findDistanceUnit(name);
	if( u == undefined ) throw new Error("No such distance unit as '"+name+"'");
	return u;
}

type DistanceUnitName = "inch"|"millimeter"|"board";
interface RationalNumber {
	numerator: number;
	denominator: number;
}
type ComplexAmount = {[unitName:string]: RationalNumber};

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




/** Carve 2D shapes at a single depth */
interface PathCarveTask
{
	typeName: "PathCarveTask";
	shapeUnitName: DistanceUnitName;
	shapes: Shape[];
	depth: ComplexAmount;
}

type Task = PathCarveTask;

/**
 * A job is a bunch of stuff that the machine should be able to do all at once.
 * Different jobs may require bit changes or other setup.
 */
interface Job
{
	name:string;
	transformation:TransformationMatrix3D;
	tasks:Task[];
}

function assertUnreachable(n:never) {
	throw new Error("Shouldn't've made it here");
}

interface RouterBit {
	name:string;
	diameterFunction:(depth:ComplexAmount)=>ComplexAmount;
}

function decodeComplexAmount(amount:ComplexAmount, nativeUnit:DistanceUnit, unitTranslations:{[k:string]: ComplexAmount}={}):number {
	let total = 0;
	for( let unitName in amount ) {
		if( unitTranslations[unitName] ) {
			total += amount[unitName].numerator * decodeComplexAmount(unitTranslations[unitName], nativeUnit) / amount[unitName].denominator;
		} else if( unitName == nativeUnit.name ) {
			total += amount[unitName].numerator / amount[unitName].denominator;
		} else {
			let unit = distanceUnits[unitName];
			if( unit == undefined ) {
				throw new Error("Invalid unit "+unitName);
			}
			let mmValue = unit.unitValueInMm * amount[unitName].numerator / amount[unitName].denominator;
			total += mmValue / nativeUnit.unitValueInMm;
		}
	}
	return total;

}

interface JobContext {
	nativeUnit: DistanceUnit;
	workpieceThickness: ComplexAmount;
	routerBit: RouterBit;
}

abstract class ShapeProcessorBase {
	protected transformation:TransformationMatrix3D = vectormath.createIdentityTransform();
	constructor(protected jobContext:JobContext) {}
	protected transformVector(vec:Vector3D):Vector3D {
		return vectormath.transformVector(this.transformation, vec);
	}
	withTransform(xf:TransformationMatrix3D, callback:()=>void) {
		let oldTransform = this.transformation;
		this.transformation = vectormath.multiplyTransform(oldTransform, xf);
		callback();
		this.transformation = oldTransform;
	}
	withShapeUnit(unit:DistanceUnit, callback:()=>void) {
		let scale = unit.unitValueInMm / this.jobContext.nativeUnit.unitValueInMm;
		this.withTransform(vectormath.scaleToTransform(scale), callback);
	}
	forEachOffset(offsets:Vector3D[], callback:()=>void ) {
		let oldTransform = this.transformation;
		for( let o in offsets ) {
			this.transformation = vectormath.multiplyTransform(oldTransform, vectormath.translationToTransform(offsets[o]));
			callback();
		}
		this.transformation = oldTransform;
	}
	decodeComplexAmount(ca:ComplexAmount):number {
		return decodeComplexAmount(ca, this.jobContext.nativeUnit, {"board": this.jobContext.workpieceThickness});
	}

	abstract processShape(shape:Shape, depth:number):void;

	processTask(task:Task):void {
		switch(task.typeName) {
		case "PathCarveTask":
			this.withShapeUnit(getDistanceUnit(task.shapeUnitName), () => {
				for( let s in task.shapes ) this.processShape(task.shapes[s], this.decodeComplexAmount(task.depth));
			});
			break;
		}
	}

	processJob(job:Job) {
		for( let t in job.tasks ) {
			this.withTransform(job.transformation, () => {
				this.processTask(job.tasks[t]);
			});
		}
	}
}

class BoundsFinder extends ShapeProcessorBase {
	public minX:number = Infinity;
	public minY:number = Infinity;
	public minZ:number = Infinity;
	public maxX:number = -Infinity;
	public maxY:number = -Infinity;
	public maxZ:number = -Infinity;

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
	processHoles(positions:Vector3D[], diameter:number) {
		for( let p in positions ) {
			this.processPoint(this.transformVector(positions[p]));
		}
	}

	processShape(shape:Shape, depth:number) {
		switch(shape.typeName) {
		case "MultiShape":
			for( let s in shape.subShapes ) {
				this.processShape(shape.subShapes[s], depth);
			}
			return;
		case "TransformShape":
			return this.withTransform(shape.transformation, () => {
				this.processShape(shape.subShape, depth);
			});
		case "Path":
			return this.processPath(shape);
		case "Points":
			this.processHoles(shape.positions, 0);
			break;
		case "RoundHoles":
			this.processHoles(shape.positions, shape.diameter);
			return;
		}
	}
}

class GCodeGenerator extends ShapeProcessorBase {
	public emitter:(s:string)=>string;
	protected zoomHeight:number;
	protected minimumFastZ:number;
	protected stepDown:number;
	public fractionDigits:number = 4;
	public commentMode:"None"|"Parentheses"|"Semicolon" = "Parentheses";
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
		case "None": return;
		case "Parentheses": return this.emit("("+c+")");
		case "Semicolon": return this.emit("; "+c);
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
		if( x != undefined ) line += " X"+x.toFixed(this.fractionDigits);
		if( y != undefined ) line += " Y"+y.toFixed(this.fractionDigits);
		if( z != undefined ) line += " Z"+z.toFixed(this.fractionDigits);
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
		line += " I"+i.toFixed(this.fractionDigits);
		line += " J"+j.toFixed(this.fractionDigits);
		line += " K"+k.toFixed(this.fractionDigits);
		if( x != undefined ) line += " X"+x.toFixed(this.fractionDigits);
		if( y != undefined ) line += " Y"+y.toFixed(this.fractionDigits);
		if( z != undefined ) line += " Z"+z.toFixed(this.fractionDigits);
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
		position = this.transformVector(position);
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
	carvePath(path:Path, depth:number):void {
		if(path.segments.length == 0) return;
		if(depth <= 0) return;

		let targetZ = 0 - depth;
		let seg0 = path.segments[0];
		let startPoint = path.vertexes[seg0.startVertexIndex];
		this.zoomTo(startPoint);
		let currentZ = 0;
		let direction = 1;
		while( currentZ > targetZ ) {
			currentZ = Math.max(targetZ, currentZ - this.stepDown);
			this.emitComment("Step down to "+currentZ.toFixed(this.fractionDigits));
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

	carveHoles(positions:Vector3D[], diameter:number, depth:number) {
		let circleRadius = diameter/2 - this.decodeComplexAmount(this.jobContext.routerBit.diameterFunction({}))/2;
		if( circleRadius <= 0 ) {
			this.emitComment(diameter + this.jobContext.nativeUnit.abbreviation + " hole will be a banger");
			for( let p in positions ) {
				this.zoomTo(positions[p]);
				this.bangHole(depth, this.stepDown, this.stepDown/2);
			}
		} else {
			this.emitComment(diameter + this.jobContext.nativeUnit.abbreviation + " hole will be circles");
			const path = circlePath(circleRadius);
			this.forEachOffset(positions, () => {
				this.carvePath(path, depth);
			})
		}
	}

	processShape(shape:Shape, depth:number) {
		switch(shape.typeName) {
		case "MultiShape":
			for( let s in shape.subShapes ) {
				this.processShape(shape.subShapes[s], depth);
			}
			return;
		case "TransformShape":
			return this.withTransform(shape.transformation, () => {
				this.processShape(shape.subShape, depth);
			});
		case "Path":
			return this.carvePath(shape, depth);
		case "Points":
			return this.carveHoles(shape.positions, 0, depth);
		case "RoundHoles":
			return this.carveHoles(shape.positions, shape.diameter, depth);
		}
		assertUnreachable(shape);
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

class SVGGenerator extends ShapeProcessorBase {
	public emitter:(s:string)=>string;
	protected bottomColor = "black";
	protected cutColor = "gray";

	// Updated as jobs/tasks are processed
	protected strokeColor = "purple";
	protected strokeWidth:number = 0;

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

	emitPath(path:Path) {
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
				dParts.push("L"+endVertex.x+","+endVertex.y);
				break;
			case "ClockwisePathSegment": case "CounterClockwisePathSegment":
				let axisVertex = this.transformVector(path.vertexes[seg.axisVertexIndex]);
				let axisDx = axisVertex.x - startVertex.x;
				let axisDy = axisVertex.y - startVertex.y;
				let radius = Math.sqrt(axisDx*axisDx + axisDy*axisDy);
				// TODO: Need to take transformation into account to determine if it's clockwise or counterclockwise
				dParts.push("A"+radius+","+radius+" 0 0 "+(seg.typeName == "ClockwisePathSegment" ? "0" : "1")+" "+endVertex.x+","+endVertex.y);
				break;
			}
			prevVertexIndex = seg.endVertexIndex;
		}
		this.openElement("path", {"fill": "none", "stroke-linecap": "round", "stroke-linejoin": "round", "stroke": this.strokeColor, "stroke-width": this.strokeWidth, "d": dParts.join(" ")}, true);
	}

	emitHoles(positions:Vector3D[], diameter:number) {
		let fill:string;
		let stroke:string;
		const tipWidth = this.decodeComplexAmount(this.jobContext.routerBit.diameterFunction({}));
		const extraDiam = this.strokeWidth - tipWidth;
		const bottomDiameter = Math.max(diameter, tipWidth);
		const circleRadius = (bottomDiameter + extraDiam)/2;
		for( let p in positions ) {
			let xfPos = this.transformVector(positions[p]);
			this.openElement("circle", {
				cx: xfPos.x, cy: xfPos.y,
				r: circleRadius,
				fill: this.strokeColor,
				"stroke-width": 0,
			}, true);
		}
	}

	processShape(shape:Shape) {
		switch(shape.typeName) {
		case "MultiShape":
			for( let s in shape.subShapes ) {
				this.processShape(shape.subShapes[s]);
			}
			return;
		case "TransformShape":
			return this.withTransform(shape.transformation, () => {
				this.processShape(shape.subShape);
			});
		case "Path":
			return this.emitPath(shape);
		case "Points":
			this.emitHoles(shape.positions, 0);
			break;
		case "RoundHoles":
			this.emitHoles(shape.positions, shape.diameter);
			return;// this.emitCircles(shape.positions, shape.diameter);
		}
	}

	processTask(task:Task) {
		switch(task.typeName) {
		case "PathCarveTask":
			this.withShapeUnit(getDistanceUnit(task.shapeUnitName), () => {
				const cutTopWidth    = this.decodeComplexAmount(this.jobContext.routerBit.diameterFunction(task.depth));
				const cutBottomWidth = this.decodeComplexAmount(this.jobContext.routerBit.diameterFunction({}));
				if( cutTopWidth > cutBottomWidth ) {
					this.strokeWidth = cutTopWidth;
					this.strokeColor = this.cutColor;
					for( let s in task.shapes ) this.processShape(task.shapes[s]);
				}
				this.strokeWidth = cutBottomWidth;
				this.strokeColor = this.bottomColor;
				for( let s in task.shapes ) this.processShape(task.shapes[s]);
			});
			break;
		}
	}

	processJob(job:Job):void {
		this.emitter("<!-- Job: "+job.name+" -->\n");
		super.processJob(job);
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

function makeTogPanelTasks(options:TOGPanelOptions):Task[] {
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
	let labelShape = textToShape(label, labelFont);
	let tasks:Task[] = [];
	if( label.length > 0 && decodeComplexAmount(options.labelDepth,INCH) > 0 ) {
		let textPlacementTransform:TransformationMatrix3D;
		if( options.labelDirection == "longitudinal" ) {
			textPlacementTransform = vectormath.translationToTransform({x:0.25, y:3 - options.labelScale/2, z:0});
		} else {
			textPlacementTransform = vectormath.multiplyTransform(
				vectormath.translationToTransform({x:options.length/2, y:0.5, z:0}),
				vectormath.xyzAxisAngleToTransform(0, 0, 1, quarterTurn)
			);
		}

		tasks.push({
			typeName: "PathCarveTask",
			depth: options.labelDepth,
			shapeUnitName: "inch",
			shapes: [
				{
					typeName: "TransformShape",
					transformation: vectormath.multiplyTransform(
						textPlacementTransform,
						vectormath.scaleToTransform(options.labelScale),
					),
					subShape: labelShape
				}
			]
		});
	}
	if( options.includeHoles ) {
		tasks.push({
			typeName: "PathCarveTask",
			shapeUnitName: "inch",
			depth: throughDepth,
			shapes: [
				{
					typeName: "RoundHoles",
					diameter: options.holeDiameter,
					positions: holePositions
				}
			]
		});
	}
	if( options.includeOutline ) {
		tasks.push({
			typeName: "PathCarveTask",
			shapeUnitName: "inch",
			depth: throughDepth,
			shapes: [
				boxPath({
					x0: 0, y0: 0,
					width: options.length, height: 3.5,
					cornerOptions: { cornerRadius: 0.25, cornerStyleName: "Round" },
				})
			]
		});
	}
	return tasks;
}

const sumRegex = /.+\+.+/;
const rationalNumberRegex = /.+\/.+/;
const decimalNumberRegex = /^([+-]?\d+(?:\.\d+)?)?/;

function lcm(a:number, b:number) {
	if( a == b ) return a;
	return a*b;
}

function addRationals(a:RationalNumber, b:RationalNumber) {
	let sumDenominator = lcm(a.denominator, b.denominator);
	return {
		numerator: a.numerator*a.denominator/sumDenominator + b.numerator*b.denominator/sumDenominator,
		denominator: sumDenominator
	}
}

function multiplyRationals(a:RationalNumber, b:RationalNumber) {
	return {
		numerator: a.numerator * b.numerator,
		denominator: a.denominator * b.denominator,
	}
}

function divideRationals(a:RationalNumber, b:RationalNumber) {
	return {
		numerator: a.numerator * b.denominator,
		denominator: a.denominator * b.numerator,
	}
}


function parseRationalNumber(numStr:string):RationalNumber {
	let m;
	if( sumRegex.exec(numStr) ) {
		return numStr.split('+').map(parseRationalNumber).reduce(addRationals);
	} else if( rationalNumberRegex.exec(numStr) ) {
		return numStr.split('/').map(parseRationalNumber).reduce(divideRationals);
	} else if( decimalNumberRegex.exec(numStr) ) {
		return {numerator: +numStr, denominator: 1};
	} else {
		throw new Error("Failed to parse '"+numStr+"' as number");
	}
}

function parseNumber(numStr:string):number {
	let rn = parseRationalNumber(numStr);
	return rn.numerator / rn.denominator;
}

function scaleComplexAmount(a:ComplexAmount, s:RationalNumber):ComplexAmount {
	if( s.numerator == s.denominator ) return a;

	let res:ComplexAmount = {};
	for( let unitCode in a ) {
		res[unitCode] = multiplyRationals(a[unitCode], s);
	}
	return res;
}

function addComplexAmounts(a:ComplexAmount, b:ComplexAmount):ComplexAmount {
	let res:ComplexAmount = {};
	for( let unitCode in a ) {
		res[unitCode] = a[unitCode];
	}
	for( let unitCode in b ) {
		if( res[unitCode] == undefined ) {
			res[unitCode] = b[unitCode];
		} else {
			res[unitCode] = addRationals(res[unitCode], b[unitCode]);
		}
	}
	return res;
}

function parseComplexAmount(caStr:string):ComplexAmount {
	let m = /^(.*)(in|mm|board)$/.exec(caStr);
	if( m == null ) throw new Error("Invalid complex amount string: '"+caStr+"'");
	let unitName:string;
	let u : DistanceUnit|undefined;
	if( m[2] == "board" ) {
		unitName = m[2];
	} else if( (u = findDistanceUnit(m[2])) != undefined ) {
		unitName = u.name;
	} else {
		throw new Error("Invalid unit name '"+m[2]+"'");
	}
	return {
		[unitName]: parseRationalNumber(m[1])
	}
}

function makeVBit(degrees:number, pointSize:ComplexAmount):RouterBit {
	const twiceSlope = Math.tan(degrees/2 * Math.PI/180);
	const pointSizeMm = decodeComplexAmount(pointSize, MM);
	return {
		name: (pointSizeMm > 0 ? pointSize + "in-tip " : "") + degrees+"-degree carving bit",
		diameterFunction: (depth) => addComplexAmounts(pointSize, scaleComplexAmount(depth, {numerator:twiceSlope, denominator:1})),
	}
}

function transformShape(xf:TransformationMatrix3D, shape:Shape):Shape {
	return {
		typeName: "TransformShape",
		transformation: xf,
		subShape: shape
	}
}

function shapeMmToInch(shape:Shape):Shape {
	return transformShape(vectormath.scaleToTransform(1/25.4), shape)
}

function translateShape(shape:Shape, offset:Vector3D):Shape {
	return transformShape(vectormath.translationToTransform(offset), shape)
}

// Parts for router:
// WSTYPE-200027 = over thingy
// WSTYPE-200028 = under thingy
// WSTYPE-200029 = better under thingy
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
			shapeUnitName: "millimeter",
			shapes: [
				shapeMmToInch({
					typeName: "Points",
					positions: pokeyHolePositions
				}),
			]
		},
		{
			typeName: "PathCarveTask",
			depth: throughDepth,
			shapeUnitName: "millimeter",
			shapes: [shapeMmToInch(pb.path)]
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
			shapeUnitName: "millimeter",
			shapes: [
				{
					typeName: "Points",
					positions: pokeyHolePositions
				},
			]
		},
		{
			typeName: "PathCarveTask",
			depth: throughDepth,
			shapeUnitName: "millimeter",
			shapes: [
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
			shapeUnitName: "millimeter",
			shapes: [
				{
					typeName: "Points",
					positions: pokeyHolePositions
				},
			]
		},
		{
			typeName: "PathCarveTask",
			depth: throughDepth,
			shapeUnitName: "millimeter",
			shapes: [
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

interface JobProcessor {
	processJob(job:Job):void;
}

function processJobs(processor:JobProcessor, jobs:Job[]) {
	for( let j in jobs ) processor.processJob(jobs[j]);
}

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
	let nativeUnit:DistanceUnit = MM;

	const makeBit = function() {
		return makeVBit(bitAngle, bitTipSize);
	}

	const getTransformation = function():TransformationMatrix3D {
		return vectormath.multiplyTransform(
			vectormath.translationToTransform(offset),
			vectormath.xyzAxisAngleToTransform(0, 0, -1, rotation*Math.PI/180)
		);
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
			nativeUnit = getDistanceUnit(m[1]);
		} else if( (m = /^--thickness=(.*)$/.exec(arg)) ) {
			workpieceThickness = parseComplexAmount(m[1]);
		} else if( (m = /^--label=(.*)$/.exec(arg)) ) {
			label = m[1];
		} else if( (m = /^--label-font=(.*)$/.exec(arg)) ) {
			labelFontName = m[1];
		} else if( (m = /^--label-direction=(longitudinal|lateral)$/.exec(arg)) ) {
			labelDirection = <LatOrLong>m[1];
		} else if( (m = /^--bit-diameter=(.+)$/.exec(arg)) ) {
			bitTipSize = parseComplexAmount(m[1]);
		} else if( (m = /^--bit-angle=(.+)$/.exec(arg)) ) {
			bitAngle = parseNumber(m[1]);
		} else if( (m = /^--padding=(.*)$/.exec(arg)) ) {
			padding = parseComplexAmount(m[1]);
		} else if( arg == "--output-bounds" ) {
			outputMode = "bounds";
		} else if( arg == "--output-gcode" ) {
			outputMode = "gcode";
		} else if( arg == "--output-svg" ) {
			outputMode = "svg";
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
		} else {
			console.error("Unrecognized argument: "+arg);
			process.exit(1);
		}
	}

	const jobContext:JobContext = {
		nativeUnit,
		workpieceThickness,
		routerBit: makeBit(),
	};

	let bf = new BoundsFinder(jobContext);
	processJobs(bf, jobs);

	switch( outputMode ) {
	case "bounds":
		console.log("x: "+bf.minX +".."+bf.maxX);
		console.log("y: "+bf.minY +".."+bf.maxY);
		console.log("z: "+bf.minZ +".."+bf.maxZ);
		break;
	case "gcode":
		let gcg = new GCodeGenerator(jobContext);
		gcg.commentMode = "None";
		gcg.emitSetupCode();
		processJobs(gcg, jobs);
		gcg.emitShutdownCode();
		break;
	case "svg":
		let padded = aabb.pad(bf, decodeComplexAmount(padding, nativeUnit));
		let sg = new SVGGenerator(jobContext);
		sg.emitHeader(padded);
		processJobs(sg, jobs);
		sg.emitFooter();
		break;
	}
}
