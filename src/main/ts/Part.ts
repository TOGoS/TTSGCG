import Shape from './Shape';
import ComplexAmount from './ComplexAmount';

export interface Pocket {
    classRef: "http://ns.nuke24.net/RoutedPart/Pocket",
    unit: ComplexAmount,
    shape: Shape,
    depth: number,
}
export interface Edge {
    classRef: "http://ns.nuke24.net/RoutedPart/Edge",
    unit: ComplexAmount,
    shape: Shape,
}
export interface CompoundPart {
    classRef: "http://ns.nuke24.net/RoutedPart/CompoundPart",
    components: Part[];
}

type Part = Pocket|Edge|CompoundPart;
export default Part;
