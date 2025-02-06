/**
 * External dependencies
 */
import ReactDOM from 'react-dom';
import axios from 'axios';

const rootElement = document.getElementById( 'root-godam-comments' );

const Comments = ( { attachmentId } ) => {
	return (
		<div>Comments</div>
	);
};

if ( rootElement ) {
	const root = ReactDOM.createRoot( rootElement );

	root.render( <Comments attachmentId={ rootElement?.dataset?.post__id } /> );
}
