/**
 * External dependencies
 */
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
/**
 * WordPress dependencies
 */
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import { updateLayerField } from '../../redux/slice/videoSlice';
import QuillEditor from '../QuillEditor';
import DOMPurify from 'isomorphic-dompurify';

const TextCTA = ( { layerID } ) => {
	const layer = useSelector( ( state ) =>
		state.videoReducer.layers.find( ( _layer ) => _layer.id === layerID ),
	);
	const dispatch = useDispatch();

	const minmalToolbarOptions = [
		[ { header: [ 1, 2, 3, false ] } ], // Heading levels
		[ 'bold', 'italic', 'underline' ], // Bold, Italic, Underline
		// [ { font: [] } ],
		[ { color: [] }, { background: [] } ], // Text and Background color
		// [ 'blockquote', 'code-block' ],
		// [ { list: 'ordered' }, { list: 'bullet' } ], // Ordered and Bullet lists
		[ { align: [] } ], // Text alignment
		[ 'link' ], // Links and Images
		// [ 'clean' ], // Remove formatting
	];

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

	function replaceRgbaWithHex( str ) {
		return str.replace(
			/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)/g,
			( match, r, g, b ) => {
				const hex = `#${ Number( r ).toString( 16 ).padStart( 2, '0' ) }${ Number( g ).toString( 16 ).padStart( 2, '0' ) }${ Number( b ).toString( 16 ).padStart( 2, '0' ) }`;
				return hex;
			},
		);
	}

	return (
		<>
			<div className="mb-2 flex items-end justify-between">
				<label htmlFor="custom-css" className="text-[11px] uppercase font-medium">{ __( 'Content', 'godam' ) }</label>
			</div>
			<QuillEditor
				intialValue={ layer.text }
				onHTMLChange={ ( val ) => {
					dispatch( updateLayerField( {
						id: layer.id,
						field: 'text',
						value: DOMPurify.sanitize( replaceRgbaWithHex( val ) ),
					} ) );
				} }
				toolbarOptions={ layer.FullEditor ? allToolbarOptions : minmalToolbarOptions }
				className="mb-4 wysiwyg-editor"
			/>
		</>
	);
};

export default TextCTA;
