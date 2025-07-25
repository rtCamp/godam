/**
 * Renders a list of <track> elements from an array of objects.
 *
 * @param {Object} props        Component props.
 * @param {Array}  props.tracks An array of track objects, each containing a `src` property and other properties.
 */
export default function Tracks( { tracks = [] } ) {
	return tracks.map( ( track ) => {
		return <track key={ track.src } { ...track } />;
	} );
}
