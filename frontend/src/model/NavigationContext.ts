import _ from 'lodash';
import OpenInterval from './interval/OpenInterval';
import { FeatureSegment } from './interval/FeatureSegment';
import ChromosomeInterval from './interval/ChromosomeInterval';
import { Feature } from './Feature';

const GAP_CHR = ''; // The special chromosome that gaps lie in.

/**
 * A implicit coordinate system for the entire genome or a gene set view.  It represents everywhere that a user could
 * potentially navigate and view.
 * 
 * A context constructs this coordinate system through an ordered list of features.  Features in NavigationContexts must
 * have non-empty, unique names.  In addition to this implicit coordinate system, NavContext methods also support
 * feature coordinates, which are a feature and base number relative to the start of the feature.
 * 
 * @author Silas Hsu
 */
class NavigationContext {
    private _name: string;
    private _features: Feature[];
    private _sortedFeatureStarts: number[];
    private _startCoordinateForFeature: Map<Feature, number>;
    private _featuresForChr: {[chr: string]: Feature[]};
    private _totalBases: number;

    /**
     * Makes a special "feature" representing a gap in the genome.  To use, insert such objects into the feature list
     * during NavigationContext construction.
     * 
     * @param {number} length - length of the gap in bases
     * @param {string} [name] - custom name of the gap feature
     * @return {Feature} a special "feature" representing a gap in the genome.
     */
    static makeGap(length: number, name='Gap'): Feature {
        return new Feature(name, new ChromosomeInterval(GAP_CHR, 0, Math.round(length)));
    }

    /**
     * @param {Feature} feature - feature to inspect
     * @return {boolean} whether the feature represents a gap in the genome
     */
    static isGapFeature(feature: Feature) {
        return feature.getLocus().chr === GAP_CHR;
    }

    /**
     * Makes a new instance.  Features must have non-empty, unique names.  The `isGenome` parameter does not change any
     * of the instance's functionality, but if it is true, it optimizes mapping functions.
     * 
     * @param {string} name - name of this context
     * @param {Feature[]} features - list of features
     * @param {boolean} isGenome - whether the context covers the entire genome
     * @throws {Error} if the feature list has a problem
     */
    constructor(name: string, features: Feature[]) {
        this._name = name;
        this._features = features;
        this._startCoordinateForFeature = new Map();
        this._sortedFeatureStarts = [];
        this._featuresForChr = _.groupBy(features, feature => feature.getLocus().chr)
        this._totalBases = 0;

        for (const feature of features) {
            if (this._startCoordinateForFeature.has(feature)) {
                throw new Error(`Duplicate feature "${feature.getName()}" detected.  Features must be unique.`);
            }
            this._startCoordinateForFeature.set(feature, this._totalBases);
            this._sortedFeatureStarts.push(this._totalBases);
            this._totalBases += feature.getLength();
        }
    }

    /**
     * @return {string} this navigation context's name, as specified in the constructor
     */
    getName() {
        return this._name;
    }

    /**
     * Gets the internal feature list.  This list should be treated as read-only; modifying its elements causes
     * undefined behavior.
     * 
     * @return {Feature[]} the internal feature list for this context
     */
    getFeatures() {
        return this._features.slice();
    }

    /**
     * @return {number} the total number of bases in this context, i.e. how many bases are navigable
     */
    getTotalBases() {
        return this._totalBases;
    }

    /**
     * Given a context coordinate, gets whether the base is navigable.
     * 
     * @param {number} base - context coordinate
     * @return {boolean} whether the base is navigable
     */
    getIsValidBase(base: number): boolean {
        return 0 <= base && base < this._totalBases;
    }

    /**
     * Gets the context coordinate of a feature's start.  Throws an error if the feature cannot be found.
     * 
     * @param {Feature} feature - the feature to find
     * @return {number} the context coordinate of the feature's start
     * @throws {RangeError} if the feature is not in this context
     */
    getFeatureStart(feature: Feature): number {
        const coordinate = this._startCoordinateForFeature.get(feature);
        if (coordinate === undefined) {
            throw new RangeError(`Feature "${feature.getName()}" not in this navigation context`);
        } else {
            return coordinate;
        }
    }

    /**
     * Given a context coordinate, gets the feature in which it is located.  Returns a FeatureSegment that has 0 length,
     * representing a single base number relative to the feature's start.
     *
     * @param {number} base - the context coordinate to look up
     * @return {FeatureSegment} corresponding feature coordinate
     * @throws {RangeError} if the base is not in this context
     */
    convertBaseToFeatureCoordinate(base: number): FeatureSegment {
        if (!this.getIsValidBase(base)) {
            throw new RangeError(
                `Base number ${base} is invalid.  Valid bases in this context: [0, ${this.getTotalBases()})`
            );
        }

        // Index of the feature that contains the context coordinate
        const index = _.sortedLastIndex(this._sortedFeatureStarts, base) - 1;
        const feature = this._features[index];
        const coordinate = base - this._sortedFeatureStarts[index];
        return new FeatureSegment(feature, coordinate, coordinate);
    }

    /**
     * Given a segment of a feature from this navigation context, gets the context coordinates the segment occupies.
     * 
     * @param {FeatureSegment} segment - feature segment from this context
     * @return {OpenInterval} context coordinates the feature segment occupies
     */
    convertFeatureSegmentToContextCoordinates(segment: FeatureSegment): OpenInterval {
        const contextStart = this.getFeatureStart(segment.feature);
        return new OpenInterval(contextStart + segment.relativeStart, contextStart + segment.relativeEnd);
    }

    /**
     * Converts genome coordinates to an interval of context coordinates.  Since coordinates can map
     * to multiple features, or none at all, this method returns a list of OpenInterval.
     * 
     * @param {ChromosomeInterval} chrInterval - genome interval
     * @return {OpenInterval[]} intervals of context coordinates
     */
    convertGenomeIntervalToBases(chrInterval: ChromosomeInterval): OpenInterval[] {
        const potentialOverlaps = this._featuresForChr[chrInterval.chr] || [];
        const contextIntervals = [];
        for (const feature of potentialOverlaps) {
            const overlap = new FeatureSegment(feature).getGenomeOverlap(chrInterval);
            if (overlap) {
                contextIntervals.push(this.convertFeatureSegmentToContextCoordinates(overlap));
            }
        }
        return contextIntervals;
    }

    /**
     * Converts a context coordinate to one that ignores gaps in this instance.  Or, put another way, if we removed all
     * gaps in this instance, what would be the context coordinate of `base` be?
     * 
     * @example
     * navContext = [10bp feature, 10bp gap, 10bp feature]
     * navContext.toGaplessCoordinate(5); // Returns 5
     * navContext.toGaplessCoordinate(15); // Returns 10
     * navContext.toGaplessCoordinate(25); // Returns 15
     * 
     * @param {number} base - the context coordinate to convert
     * @return {number} context coordinate if gaps didn't exist
     */
    toGaplessCoordinate(base: number): number {
        const featureCoordinate = this.convertBaseToFeatureCoordinate(base);
        const featureIndex = this._features.findIndex(feature => feature === featureCoordinate.feature);
        const gapFeaturesBefore = this._features.slice(0, featureIndex).filter(NavigationContext.isGapFeature);
        let gapBasesBefore = _.sumBy(gapFeaturesBefore, feature => feature.getLength());
        if (NavigationContext.isGapFeature(featureCoordinate.feature)) {
            gapBasesBefore += featureCoordinate.relativeStart;
        }
        return base - gapBasesBefore;
    }

    /**
     * Parses an location in this navigation context.  Should be formatted like "$chrName:$startBase-$endBase" OR
     * "$featureName".  We expect 0-indexed intervals.
     * 
     * Returns an open interval of context coordinates.  Throws RangeError on parse failure.
     *
     * @param {string} str - the string to parse
     * @return {OpenInterval} the context coordinates represented by the string
     * @throws {RangeError} when parsing an interval outside of the context or something otherwise nonsensical
     */
    parse(str: string): OpenInterval {
        const intervalMatch = str.match(/([\w:]+):(\d+)-(\d+)/);
        if (intervalMatch) {
            const locus = ChromosomeInterval.parse(str);
            const contextCoords = this.convertGenomeIntervalToBases(locus)[0];
            if (!contextCoords) {
                throw new RangeError('Location not available in this context');
            } else {
                return contextCoords;
            }
        }

        const feature = this._features.find(feature => feature.getName() === str);
        if (!feature) {
            throw new RangeError(`Could not find feature or chromosome with name of "${str}"`);
        }
        return this.convertFeatureSegmentToContextCoordinates(new FeatureSegment(feature));
    }

    /**
     * Queries features that overlap an open interval of context coordinates.  Returns a list of FeatureSegment.
     * 
     * @param {number} queryStart - (inclusive) start of interval, as a context coordinate
     * @param {number} queryEnd - (exclusive) end of interval, as a context coordinate
     * @param {boolean} [includeGaps] - whether to include gaps in the results.  Default: true
     * @return {FeatureSegment[]} list of feature intervals
     */
    getFeaturesInInterval(queryStart: number, queryEnd: number, includeGaps=true): FeatureSegment[] {
        const queryInterval = new OpenInterval(queryStart, queryEnd);
        const results = [];
        for (const feature of this._features) { // Check each feature for overlap with the query interval
            if (!includeGaps && NavigationContext.isGapFeature(feature)) {
                continue;
            }
            const start = this.getFeatureStart(feature);
            const end = start + feature.getLength(); // Noninclusive
            const overlap = new OpenInterval(start, end).getOverlap(queryInterval);

            if (overlap) {
                const relativeStart = overlap.start - start;
                const relativeEnd = overlap.end - start
                results.push(new FeatureSegment(feature, relativeStart, relativeEnd));
            } else if (results.length > 0) { // No overlap
                // Since features are sorted by start, we can be confident that there will be no more overlaps if we
                // have seen overlaps before.
                break;
            }
        }
        return results;
    }

    /**
     * Queries genomic locations that overlap an open interval of context coordinates.  The results are guaranteed to
     * not overlap each other.
     * 
     * @param {number} queryStart - (inclusive) start of interval, as a context coordinate
     * @param {number} queryEnd - (exclusive) end of interval, as a context coordinate
     * @return {ChromosomeInterval[]} list of genomic locations
     */
    getLociInInterval(queryStart: number, queryEnd: number) {
        const featureSegments = this.getFeaturesInInterval(queryStart, queryEnd, false);
        const loci = featureSegments.map(interval => interval.getLocus());
        return ChromosomeInterval.mergeOverlaps(loci);
    }
}

export default NavigationContext;
