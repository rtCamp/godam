/**
 * WordPress dependencies
 */
import { useState, useEffect } from '@wordpress/element';
import { Button, TextareaControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
/**
 * External dependencies
 */
import axios from 'axios';

const CommentForm = ( { className, value, onChange, postId, commentId, parentCommentId, onClose, onAdd, onEdit, onReply } ) => {
	const [ commentText, setCommentText ] = useState( value );
	const [ commentType, setCommentType ] = useState( 'comment' );
	const [ text, setText ] = useState( 'Comment' );

	useEffect( () => {
		if ( onChange ) {
			onChange( commentText );
		}
	}, [ commentText, onChange ] );

	useEffect( () => {
		if ( ! commentId && ! parentCommentId ) {
			// Create a new comment.
			setCommentType( 'comment' );
			setText( {
				placeholder: __( 'Leave a comment', 'godam' ),
				btnText: __( 'Comment', 'godam' ),
			} );
		} else if ( commentId && ! parentCommentId ) {
			// Update a comment.
			setCommentType( 'edit' );
			setText( {
				placeholder: __( 'Update a comment', 'godam' ),
				btnText: __( 'Save', 'godam' ),
			} );
		} else if ( parentCommentId ) {
			// Reply to a comment.
			setCommentType( 'reply' );
			setText( {
				placeholder: __( 'Reply to comment', 'godam' ),
				btnText: __( 'Reply', 'godam' ),
			} );
		}
	}, [] );

	const handleSubmit = () => {
		if ( ! commentText ) {
			return;
		}
		if ( ! commentId && ! parentCommentId ) {
			// Create a new comment.
			axios.post( `/wp-json/wp/v2/comments`, {
				author: window.wpUser.ID,
				author_email: window.wpUser.email,
				post: postId,
				content: commentText,
				meta: {
					_godam_reaction_time: 3,
				},
			}, {
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': window.wpUser.nonce,
				},
			} )
				.then( ( response ) => {
					console.log( response.data );
					onAdd( response.data );
					setCommentText( '' );
				} )
				.catch( ( error ) => {
					console.error( error );
				} );
		} else if ( commentId && ! parentCommentId ) {
			// Update a comment.
			axios.post( `/wp-json/wp/v2/comments/${ commentId }`, {
				content: commentText,
			}, {
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': window.wpUser.nonce,
				},
			} )
				.then( ( response ) => {
					console.log( response.data );
					onEdit( response.data );
					setCommentText( '' );
				} )
				.catch( ( error ) => {
					console.error( error );
				} );
		} else if ( parentCommentId ) {
			// Reply to a comment.
			axios.post( `/wp-json/wp/v2/comments`, {
				author: window.wpUser.ID,
				author_email: window.wpUser.email,
				post: postId,
				parent: parentCommentId,
				content: commentText,
				meta: {
					_godam_reaction_time: 3,
				},
			}, {
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': window.wpUser.nonce,
				},
			} )
				.then( ( response ) => {
					console.log( response.data );
					onReply( response.data );
					setCommentText( '' );
				} )
				.catch( ( error ) => {
					console.error( error );
				} );
		}
	};

	console.log( commentType );

	return (
		<form
			id={ `godam-comment-form-${ postId }` }
			className={ className }
		>
			<div className="godam-comment-form">
				<TextareaControl
					__nextHasNoMarginBottom
					placeholder={ text.placeholder }
					value={ commentText }
					onChange={ setCommentText }
					rows={ 2 }
				/>
				<div
					className="godam-comment-form-btns"
				>
					{ ( commentType === 'reply' || commentType === 'edit' ) &&
						<Button
							variant="tertiary"
							size="small"
							className="godam-comment-cancel-btn"
							onClick={ onClose }
						>{ __( 'Cancel', 'godam' ) }</Button>
					}
					{
						<Button
							isPrimary
							size="small"
							className="godam-comment-submit-btn"
							onClick={ handleSubmit }
							disabled={ ! commentText || commentText.trim().length < 1 }
						>{ text.btnText }</Button>
					}
				</div>
			</div>
		</form>
	);
};

export default CommentForm;
