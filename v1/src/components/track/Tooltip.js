import React from 'react';
import ReactDOM from 'react-dom';
import PropTypes from 'prop-types';
import { Manager, Target, Popper, Arrow } from 'react-popper';
import OutsideClickDetector from '../OutsideClickDetector';
import { getPageCoordinates } from '../../util';

const BACKGROUND_COLOR = "rgba(173, 216, 230, 0.9)"; // lightblue with opacity adjustment
const ARROW_SIZE = 15;
const ARROW_STYLE = { // This is for a upwards-pointing arrow; other directions will require more code.
    width: 0,
    height: 0,
    position: "absolute",
    top: -ARROW_SIZE,
    borderLeft: `${ARROW_SIZE/2}px solid transparent`,
    borderRight: `${ARROW_SIZE/2}px solid transparent`,
    borderBottom: `${ARROW_SIZE}px solid ${BACKGROUND_COLOR}`,
}

/**
 * Stops the propagation of an event.
 * 
 * @param {Event} event - event for which to stop propagation
 */
function stopEvent(event) {
    event.stopPropagation()
}

/**
 * A tooltip with a upwards-pointing arrow, and content below.  Its position refers to the tip of the arrow.  Content is
 * managed via children.  Does not close itself; however, there is a `onClose` prop that requests closings.
 * 
 * @author Silas Hsu
 */
class Tooltip extends React.PureComponent {
    static propTypes = {
        pageX: PropTypes.number.isRequired, // x of the tip of the arrow
        pageY: PropTypes.number.isRequired, // x of the tip of the arrow
        ignoreMouse: PropTypes.bool, // Whether the content should be invisible to mouse events
        onClose: PropTypes.func, // Called when the tooltip wants to close.  Signature: (event: MouseEvent): void
    };

    /**
     * @inheritdoc
     */
    render() {
        const {pageX, pageY, onClose, ignoreMouse, children} = this.props;
        const contentStyle = {
            zIndex: 1,
            borderRadius: 5,
            backgroundColor: BACKGROUND_COLOR,
            marginTop: ARROW_SIZE,
            pointerEvents: ignoreMouse ? "none" : "auto"
        };

        /**
         * On the stopEvent for onMouseDown: despite being in document.body, parents of the Tooltip in React's virtual
         * DOM will still get mouse events.  Stopping propagation stops several undesirable behaviors related to
         * dragging.
         */
        return ReactDOM.createPortal(
            <Manager>
                <Target style={{position: "absolute", left: pageX, top: pageY}} />
                <Popper placement="bottom-start" style={contentStyle} onMouseDown={stopEvent} modifiers={{preventOverflow: {boundariesElement: document.body}}} >
                    <OutsideClickDetector onOutsideClick={onClose} >
                        {children}
                    </OutsideClickDetector>
                    <Arrow style={ARROW_STYLE} />
                </Popper>
            </Manager>,
            document.body
        );
    }
}

export default Tooltip;
