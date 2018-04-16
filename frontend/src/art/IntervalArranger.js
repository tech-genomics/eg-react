/**
 * Arranges intervals into rows so they avoid overlap as much as possible when drawn.  Intervals MUST have props
 * `start` and `end`.
 * 
 * @author Silas Hsu
 */
class IntervalArranger {
    /**
     * Makes a new instance configured with options:
     *  * `getPadding`: a function used to get horizontal padding for each interval.  It will get the interval as an
     * argument and should return the padding as a number.  By default, all intervals get a padding of 0.
     *  * `numRows`: maximum number of rows in which to place intervals.  If a interval does not fit, it is given a row
     * index of -1.  Default: 10
     * 
     * @param {LinearDrawingModel} drawModel - model for determining where intervals will display
     * @param {function} [getPadding] - function that gets padding for each interval
     * @param {number} [numRows] - maximum number of rows
     */
    constructor(drawModel, numRows=10, getPadding=(interval => 0)) {
        this.drawModel = drawModel;
        this.getPadding = getPadding;
        this.numRows = numRows;
    }

    /**
     * Sorts intervals by start.  If two intervals they have the same start, the longer interval comes first.
     * 
     * @param {OpenInterval[]} intervals - intervals to sort
     * @return {OpenInterval[]} sorted intervals
     */
    _sortIntervals(intervals) {
        return intervals.sort((interval1, interval2) => {
            const startComparison = interval1.start - interval2.start;
            if (startComparison === 0) {
                return interval2.getLength() - interval1.getLength();
            } else {
                return startComparison;
            }
        });
    }

    /**
     * Assigns each interval a row index, or -1 if the interval will not fit into this instance's maximum configured
     * rows.
     * 
     * @param {OpenInterval[]} intervals - intervals to which to assign row indicies
     * @return {number[]} assigned row index for each interval
     */
    arrange(intervals) {
        if (this.numRows <= 0) {
            return new Array(intervals.length).fill(-1);
        }

        let maxXsForRows = new Array(this.numRows).fill(-Infinity);
        let rowIndices = [];
        const sortedIntervals = this._sortIntervals(intervals);
        for (let interval of sortedIntervals) {
            const horizontalPadding = this.getPadding(interval);
            const startX = this.drawModel.baseToX(interval.start) - horizontalPadding;
            // Find the first row where the annotation won't overlap with others in the row
            let row = maxXsForRows.findIndex(maxX => maxX < startX);
            if (row !== -1) {
                const endX = this.drawModel.baseToX(interval.end);
                maxXsForRows[row] = endX + horizontalPadding;
            }

            rowIndices.push(row);
        }

        return rowIndices;
    }
}

export default IntervalArranger;
