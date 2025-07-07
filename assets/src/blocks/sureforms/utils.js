/**
 * WordPress dependencies
 */
import { useSelect } from '@wordpress/data';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { useState, useEffect } from '@wordpress/element';

export const useGetCurrentFormId = ( clientId ) => {
	return useSelect( ( select ) => {
		// parent block id attribute.
		const parents = select( blockEditorStore ).getBlockParents( clientId );
		const parentBlock = select( blockEditorStore ).getBlocksByClientId(
			parents?.[ 0 ],
		);
		// current post id.
		const postId = select( 'core/editor' ).getCurrentPostId();
		return parentBlock?.[ 0 ]?.attributes?.id || postId;
	} );
};

/**
 * Generate Required Error Message.
 *
 * @param {string} message Custom error message.
 * @return {Object} currentErrorMsg, setCurrentErrorMsg, currentUniqueMessage, setCurrentUniqueMessage.
 */
export const useErrMessage = ( message ) => {
	const [ currentMessage, setCurrentMessage ] = useState();

	useEffect( () => {
		setCurrentMessage( message );
	}, [ message ] );

	return { currentMessage, setCurrentMessage };
};

/**
 * Get Max file size for the site.
 */
export function getMaxFileSize() {
	const maxFileSizeUpload =
	window?._wpPluploadSettings?.defaults?.filters?.max_file_size;

	const numericPart = maxFileSizeUpload.replace( /b$/i, '' );
	const sizeInBytes = parseInt( numericPart, 10 );

	return Math.floor( sizeInBytes / ( 1024 * 1024 ) );
}
