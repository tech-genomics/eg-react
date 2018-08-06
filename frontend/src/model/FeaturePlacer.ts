import DisplayedRegionModel from './DisplayedRegionModel';
import { Feature } from './Feature';
import OpenInterval from './interval/OpenInterval';
import LinearDrawingModel from './LinearDrawingModel';
import NavigationContext from './NavigationContext';
import { FeatureSegment } from './interval/FeatureSegment';
import { GenomeInteraction } from './GenomeInteraction';

/**
 * Draw information for a Feature
 */
export interface PlacedFeature {
    feature: Feature; // The feature
    /**
     * The feature's *visible* part.  "Visible" means the parts of the feature that lie inside the nav context, as some
     * parts might fall outside.  For example, the feature is chr1:0-200 but the context only contains chr1:50-100.
     */
    visiblePart: FeatureSegment;
    contextLocation: OpenInterval; // The feature's *visible* part in navigation context coordinates
    xSpan: OpenInterval; // Horizontal location of the feature's *visible* part
}

export interface PlacedSegment {
    segment: FeatureSegment; // The segment, truncated to the visible part
    xSpan: OpenInterval; // The x span of the segment
}

export class PlacedInteraction {
    interaction: GenomeInteraction; // The interaction
    /**
     * x span to draw the first region of the interaction.  Guaranteed to have the lower start of both the two spans.
     */
    xSpan1: OpenInterval;
    xSpan2: OpenInterval; // x span to draw the second region of the interaction

    constructor(interaction: GenomeInteraction, xSpan1: OpenInterval, xSpan2: OpenInterval) {
        this.interaction = interaction;
        if (xSpan1.start <= xSpan2.start) { // Ensure the x spans are ordered
            this.xSpan1 = xSpan1;
            this.xSpan2 = xSpan2;
        } else {
            this.xSpan1 = xSpan2;
            this.xSpan2 = xSpan1;
        }
    }

    /**
     * @return {number} the length of the interaction in draw coordinates
     */
    getWidth(): number {
        const start = this.xSpan1.start; // Guaranteed to have to lower start
        const end = Math.max(this.xSpan1.end, this.xSpan2.end);
        return end - start;
    }

    generateKey(): string {
        return "" + this.xSpan1.start + this.xSpan1.end + this.xSpan2.start + this.xSpan2.end;
    }
}

export class FeaturePlacer {
    /**
     * Computes context and draw locations for a list of features.  There may be a different number of placed features
     * than input features, as a feature might map to several different nav context coordinates, or a feature might
     * not map at all.
     * 
     * @param {Feature[]} features - features for which to compute draw locations
     * @param {DisplayedRegionModel} viewRegion - region in which to draw
     * @param {number} width - width of visualization
     * @return {PlacedFeature[]} draw info for the features
     */
    placeFeatures(features: Feature[], viewRegion: DisplayedRegionModel, width: number): PlacedFeature[] {
        const drawModel = new LinearDrawingModel(viewRegion, width);
        const viewRegionBounds = viewRegion.getContextCoordinates();
        const navContext = viewRegion.getNavigationContext();

        const placements = [];
        for (const feature of features) {
            for (let contextLocation of feature.computeNavContextCoordinates(navContext)) {
                contextLocation = contextLocation.getOverlap(viewRegionBounds); // Clamp the location to view region
                if (contextLocation) {
                    const xSpan = drawModel.baseSpanToXSpan(contextLocation);
                    const visiblePart = this._getVisibleSegment(feature, navContext, contextLocation);
                    placements.push({ feature, visiblePart, contextLocation, xSpan });
                }
            }
        }

        return placements;
    }

    /**
     * Gets the visible part of a feature after it has been placed in a navigation context.
     * 
     * @param {Feature} feature - feature placed in a navigation context
     * @param {NavigationContext} contextLocation - navigation context in which the feature was placed
     * @param {OpenInterval} navContext - the feature's visible part in navigation context coordinates
     * @return {FeatureSegment} - the visible part of the feature
     */
    _getVisibleSegment(feature: Feature, navContext: NavigationContext, contextLocation: OpenInterval): FeatureSegment {
        const placedLocus = navContext.convertBaseToFeatureCoordinate(contextLocation.start).getLocus();
        const distFromFeatureLocus = placedLocus.start - feature.getLocus().start;
        const relativeStart = Math.max(0, distFromFeatureLocus);
        return new FeatureSegment(feature, relativeStart, relativeStart + contextLocation.getLength());
    }

    /**
     * Gets draw spans for feature segments, given a parent feature that has already been placed.
     * 
     * @param {PlacedFeature} placedFeature 
     * @param {FeatureSegment[]} segments 
     * @return {PlacedSegment[]}
     */
    placeFeatureSegments(placedFeature: PlacedFeature, segments: FeatureSegment[]): PlacedSegment[] {
        const pixelsPerBase = placedFeature.xSpan.getLength() / placedFeature.contextLocation.getLength();
        const placements = [];
        for (const segment of segments) {
            const visibleSegment = segment.getOverlap(placedFeature.visiblePart);
            if (visibleSegment) {
                const basesFromVisiblePart = visibleSegment.relativeStart - placedFeature.visiblePart.relativeStart;
                const distanceFromXSpan = basesFromVisiblePart * pixelsPerBase;
                const xSpanStart = placedFeature.xSpan.start + distanceFromXSpan;
                const xSpanLength = visibleSegment.getLength() * pixelsPerBase;
                placements.push({
                    segment: visibleSegment,
                    xSpan: new OpenInterval(xSpanStart, xSpanStart + xSpanLength)
                });
            }
        }

        return placements;
    }

    placeInteractions(interactions: GenomeInteraction[], viewRegion: DisplayedRegionModel,
        width: number): PlacedInteraction[]
    {
        const drawModel = new LinearDrawingModel(viewRegion, width);
        const viewRegionBounds = viewRegion.getContextCoordinates();
        const navContext = viewRegion.getNavigationContext();

        const mappedInteractions = [];
        for (const interaction of interactions) {
            let contextLocations1 = navContext.convertGenomeIntervalToBases(interaction.locus1);
            let contextLocations2 = navContext.convertGenomeIntervalToBases(interaction.locus2);
            // Clamp the locations to the view region
            contextLocations1 = contextLocations1.map(location => location.getOverlap(viewRegionBounds));
            contextLocations2 = contextLocations2.map(location => location.getOverlap(viewRegionBounds));
            for (const location1 of contextLocations1) {
                for (const location2 of contextLocations2) {
                    if (location1 && location2) {
                        const xSpan1 = drawModel.baseSpanToXSpan(location1);
                        const xSpan2 = drawModel.baseSpanToXSpan(location2);
                        mappedInteractions.push(new PlacedInteraction(interaction, xSpan1, xSpan2));
                    }
                }
            }
        };

        return mappedInteractions;
    }
}
