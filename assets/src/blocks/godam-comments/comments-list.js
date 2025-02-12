/**
 * External dependencies
 */
import axios from 'axios';

/**
 * WordPress dependencies
 */
import { Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { edit, trash } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import CommentForm from './comment-form';

const CommentsList = ( { postId, comments, updateComments, editCommentId, setEditCommentId, replayCommentId, setReplayCommentId, isChild } ) => {
	// Function to calculate time ago.
	function timeAgo( gmtDateString ) {
		const date = new Date( gmtDateString );

		const now = new Date();
		const diffInSeconds = Math.floor( ( now - date ) / 1000 );

		if ( diffInSeconds < 60 ) {
			return 'just now';
		}
		const minutes = Math.floor( diffInSeconds / 60 );
		if ( minutes < 60 ) {
			return `${ minutes }min`;
		}
		const hours = Math.floor( minutes / 60 );
		if ( hours < 24 ) {
			return `${ hours }h`;
		}
		const days = Math.floor( hours / 24 );
		if ( days < 30 ) {
			return `${ days }d`;
		}
		const months = Math.floor( days / 30 );
		if ( months < 12 ) {
			return `${ months }m`;
		}
		const years = Math.floor( days / 365 );
		return `${ years }y`;
	}

	const deleteComment = ( commentId ) => {
		// Delete a comment.
		// Update a comment.
		axios.delete( `/wp-json/wp/v2/comments/${ commentId }`, {
			headers: {
				'Content-Type': 'application/json',
				'X-WP-Nonce': window.wpUser.nonce,
			},
		} )
			.then( ( response ) => {
				updateComments( 'delete', { id: commentId } );
			} )
			.catch( ( error ) => {
				console.error( error );
			} );
	};

	console.log( window.wpUser );
	

	return (
		<>
			<ul className={ `godam-comments-list ${ isChild ? 'child' : '' }` }>
				{
					comments.map( ( comment ) => {
						return (
							<li
								key={ comment.id }
							>
								{
									editCommentId === comment.id ? (
										<CommentForm
											postId={ postId }
											commentId={ comment.id }
											onClose={ () => setEditCommentId( null ) }
											value={ comment.content.raw }
											onEdit={ ( data ) => {
												updateComments( 'edit', { ...data, children: comment.children } );
												setEditCommentId( null );
											} }
										/>
									) : (
										<>
											<div className="godam-comments-list--item">
												<div className="godam-comments-list--item--header">
													<div className="godam-comments-list--item--header--author">{ comment.author_name }</div>
													<div className="godam-comments-list--item--header--date">{ timeAgo( comment.date_gmt ) }</div>
													<div className="godam-comments-list--item--header--controls">
														{
															Number( window?.wpUser?.ID ) === comment.author && (
																<Button
																	icon={ edit }
																	size="small"
																	onClick={ () => {
																		setReplayCommentId( null );
																		setEditCommentId( comment.id );
																	} }
																/>
															)
														}
														{
															Number( window?.wpUser?.ID ) === comment.author && (
																<Button
																	icon={ trash }
																	isDestructive
																	size="small"
																	onClick={ () => {
																		deleteComment( comment.id );
																	} }
																/>
															)
														}
													</div>
												</div>

												<div className="godam-comments-list--item--content" dangerouslySetInnerHTML={ { __html: comment.content.rendered } } />

												{
													replayCommentId !== comment.id &&
													<div className="godam-comments-list--item--footer">
														<Button
															variant="tertiary"
															size="small"
															className="replay"
															onClick={ () => {
																setEditCommentId( null );
																setReplayCommentId( comment.id );
															} }
														>
															{ __( 'Reply', 'godam' ) }
														</Button>
													</div>
												}
												{
													replayCommentId === comment.id && (
														<CommentForm
															className="pl-6 mt-4"
															postId={ postId }
															parentCommentId={ comment.id }
															onClose={ () => setReplayCommentId( null ) }
															onReply={ ( data ) => {
																updateComments( 'addReply', { ...data, Children: [] } );
																setReplayCommentId( null );
															} }
														/>
													)
												}
											</div>
										</>
									)
								}
								{
									comment.children.length > 0 && (
										<CommentsList
											postId={ postId }
											comments={ comment.children }
											updateComments={ updateComments }
											editCommentId={ editCommentId }
											setEditCommentId={ setEditCommentId }
											replayCommentId={ replayCommentId }
											setReplayCommentId={ setReplayCommentId }
											isChild={ true }
										/>
									)
								}
							</li>
						);
					} )
				}
			</ul>
		</>
	);
};

export default CommentsList;
