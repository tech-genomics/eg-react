import React from "react";
import PropTypes from "prop-types";
import TrackModel from "model/TrackModel";
import DisplayedRegionModel from "model/DisplayedRegionModel";
import Molstar3D from "./Molstar3D";

class MolstarContainer extends React.PureComponent {
    static propTypes = {
        tracks: PropTypes.arrayOf(PropTypes.instanceOf(TrackModel)).isRequired, // g3d Tracks to render
        viewRegion: PropTypes.instanceOf(DisplayedRegionModel).isRequired,
    };

    constructor(props) {
        super(props);
        this.myRef = React.createRef();
    }

    componentDidMount() {
        this.visualG3d();
    }

    visualG3d = async () => {
        const { tracks } = this.props;
        const trackModel = tracks[0];
        const mol = new Molstar3D(this.myRef.current);
        await mol.init({ url: trackModel.url });
        mol.showChrom3dStruct('chr7');
        mol.showRegion3dStruct('chr7', 2000000, 7000000);
        // mol.decorChrom3d();
        mol.decorRegion3d();
        await mol.final();
    };

    render() {
        return <div ref={this.myRef}></div>;
    }
}

export default MolstarContainer;
