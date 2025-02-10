/**
 * WordPress dependencies
 */
import { useBlockProps } from '@wordpress/block-editor';
import { useSelect } from '@wordpress/data';
import { useEffect } from '@wordpress/element';

const edit = ( { attributes, setAttributes } ) => {
	const blockProps = useBlockProps();

	const select = useSelect( ( selector ) => selector );

	const postId = select( 'core/editor' ).getCurrentPostId();

	useEffect( () => {
		if ( postId && postId !== attributes.post_id ) {
			setAttributes( { post_id: postId } );
		}
	}, [ postId ] );

	return (
		<div
			{ ...blockProps }
		>GoDAM comments</div>
	);
};

export default edit;
