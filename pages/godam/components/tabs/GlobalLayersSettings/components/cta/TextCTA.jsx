/**
 * External dependencies
 */
import { useSelector, useDispatch } from 'react-redux';
import DOMPurify from 'isomorphic-dompurify';

/**
 * Internal dependencies
 */
import { updateMediaSetting } from '../../../../../redux/slice/media-settings.js';
import QuillEditor from '../../../../../../video-editor/components/QuillEditor.js';

const TextCTA = () => {
	const dispatch = useDispatch();

	// Get media settings from Redux store
	const mediaSettings = useSelector( ( state ) => state.mediaSettings );

	// Function to handle setting change
	const handleSettingChange = ( key, value ) => {
		dispatch( updateMediaSetting( { category: 'global_layers', subcategory: 'cta', key, value } ) );
	};

	const allToolbarOptions = [
		[ { header: [ 1, 2, 3, false ] } ], // Heading levels
		[ { font: [] } ],
		[ 'bold', 'italic', 'underline' ], // Bold, Italic, Underline
		[ { color: [] }, { background: [] } ], // Text and Background color
		[ 'blockquote', 'code-block' ],
		[ { list: 'ordered' }, { list: 'bullet' } ], // Ordered and Bullet lists
		[ { align: [] } ], // Text alignment
		[ 'link' ], // Links and Images
		[ 'clean' ], // Remove formatting
	];

	return (
		<div className="mb-4">
			<QuillEditor
				initialValue={ mediaSettings?.global_layers?.cta?.text || '' }
				onHTMLChange={ ( val ) => handleSettingChange( 'text', DOMPurify.sanitize( val ) ) }
				toolbarOptions={ allToolbarOptions }
				className="mb-4 wysiwyg-editor"
			/>
		</div>
	);
};

export default TextCTA;
