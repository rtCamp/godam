/* global jQuery, RTGodamVideoGallery, GODAMPlayer */

/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';

/**
 * External dependencies
 */
import { createRoot } from 'react-dom/client';
import {
	Modal,
	TextControl,
	Button,
	Spinner,
} from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { useRef, useEffect } from 'react';

/**
 * Internal dependencies
 */
import Ptag from '../../../images/product-tag.svg';

jQuery( document ).ready( function( $ ) {
	const videoList = $( '.godam-product-video-gallery-list' );

	const tagIconSVG = `<img src="${ Ptag }"
    alt="${ __( 'Product tag', 'godam' ) }"
    class="godam-tag-icon" />`;

	const CURRENT_ID = Number( RTGodamVideoGallery.currentProductId );

	/* ---------- NEW: “ + Add Products” button ---------- */
	videoList.on( 'click', '.godam-add-product-button', function( e ) {
		e.preventDefault();

		const $button = $( this );
		const $li = $( this ).closest( 'li' );
		const url = $li.find( 'input[name="rtgodam_product_video_gallery_urls[]"]' ).val();
		const vidId = parseInt( $li.find( '[data-vid-id]' ).data( 'vid-id' ), 10 );

		openProductPicker( vidId, url, ( count ) => {
			// When the modal closes, update the button text.
			if ( count > 0 ) {
				const productText = sprintf(
					/* translators: 1: count, 2: plural suffix (s if >1) */
					__( '%1$d product%2$s', 'godam' ),
					count,
					count > 1 ? 's' : '',
				);

				$button.html( `${ tagIconSVG }&nbsp;${ productText }` );

				$button.attr(
					'aria-label',
					sprintf(
						/* translators: 1: count, 2: plural suffix (s if >1) */
						__( '%1$d product%2$s attached to this video', 'godam' ),
						count,
						count > 1 ? 's' : '',
					),
				);
			} else {
				const addLabel = __( '+ Add Products', 'godam' );
				$button.text( addLabel );
				$button.attr( 'aria-label', addLabel );
			}
		}, $button, $li );
	} );

	const selectedProductsMap = new Map();

	/* ---------- Product Picker Modal implementation ---------- */
	const openProductPicker = ( attachmentId, url, onDone = () => {}, $button, $li ) => {
		const container = document.createElement( 'div' );
		document.body.appendChild( container );

		const Picker = () => {
			const [ search, setSearch ] = wp.element.useState( '' );
			const [ results, setResults ] = wp.element.useState( [] );
			const [ loading, setLoading ] = wp.element.useState( false );

			const dataAttr = $li.find( '.godam-add-product-button' ).attr( 'data-linked-products' ) || '[]';

			const linkedFromBackend = JSON
				.parse( dataAttr )
				.filter( ( p ) => p.id !== CURRENT_ID );

			const initialSelected = linkedFromBackend.length
				? linkedFromBackend
				: ( selectedProductsMap.get( attachmentId ) || [] );

			const [ selected, setSelected ] = wp.element.useState( initialSelected );

			const doSearch = wp.element.useCallback( () => {
				if ( ! search ) {
					setResults( [] );
					return;
				}
				setLoading( true );
				apiFetch( {
					path: `${ RTGodamVideoGallery.namespace }${ RTGodamVideoGallery.productsEP }?search=${ encodeURIComponent( search ) }`,
				} ).then( ( res ) => {
					setResults( res.filter( ( p ) => p.id !== CURRENT_ID ) );
					setLoading( false );
				} );
			}, [ search ] );

			const toggleSelect = ( product ) => {
				setSelected( ( prev ) => {
					const exists = prev.find( ( p ) => p.id === product.id );
					if ( exists ) {
						return prev.filter( ( p ) => p.id !== product.id );
					}
					return [ ...prev, product ];
				} );
			};

			// Helper to validate timestamp format.
			const isValidTimestamp = ( value, videoDuration ) => {
				if ( ! value ) {
					return true;
				}

				// Match hh:mm:ss or mm:ss.
				const parts = value.split( ':' ).map( Number );
				if ( parts.some( isNaN ) ) {
					return false;
				}

				let seconds = 0;
				if ( parts.length === 3 ) {
					seconds = ( parts[ 0 ] * 3600 ) + ( parts[ 1 ] * 60 ) + parts[ 2 ];
				} else if ( parts.length === 2 ) {
					seconds = ( parts[ 0 ] * 60 ) + parts[ 1 ];
				} else {
					return false;
				}

				return seconds <= videoDuration;
			};

			const addToProducts = () => {
				const videoPlayer = document.querySelector( '.godam-admin-video-add-to-product-container video' );
				const videoDuration = videoPlayer ? Math.floor( videoPlayer.duration ) : Infinity;

				let hasInvalid = false;

				selected.forEach( ( product ) => {
					const input = document.getElementById( `timestamp_${ product.id }` );
					const timestampValue = input ? input.value.trim() : '';

					if ( ! isValidTimestamp( timestampValue, videoDuration ) ) {
						hasInvalid = true;
						input.style.border = '1px solid red';
					} else if ( input ) {
						input.style.border = '1px solid #ddd';
					}
				} );

				// Stop saving the Products if Timestamp is Invalid.
				if ( hasInvalid ) {
					// eslint-disable-next-line no-alert
					window.alert( __( 'One or more timestamps are invalid or exceed video duration.', 'godam' ) );
					return;
				}

				selected.forEach( ( product ) => {
					if ( product.id === CURRENT_ID ) {
						return;
					}

					// Save link between product and video.
					apiFetch( {
						path: `${ RTGodamVideoGallery.namespace }${ RTGodamVideoGallery.linkVideoEP }`,
						method: 'POST',
						data: {
							product_id: product.id,
							attachment_id: attachmentId,
							url,
						},
					} ).catch( () => {
						// eslint-disable-next-line no-alert
						window.alert( __( 'Failed to link video to product', 'godam' ) + ' ' + product.id );
					} );

					// Get timestamp input value for the product
					const input = document.getElementById( `timestamp_${ product.id }` );
					const timestampValue = input ? input.value.trim() : '';

					// Save timestamp as product meta.
					apiFetch( {
						path: `${ RTGodamVideoGallery.namespace }${ RTGodamVideoGallery.timestampEP }`,
						method: 'POST',
						data: {
							product_id: product.id,
							meta_key: `godam_product_timestamp_meta_${ attachmentId }`,
							meta_value: timestampValue,
						},
					} ).catch( () => {
						// eslint-disable-next-line no-alert
						window.alert( __( `Failed to save timestamp for product`, 'godam' ) );
					} );
				} );

				selectedProductsMap.set( attachmentId, selected );

				$button.attr( 'data-linked-products', JSON.stringify( selected ) );

				onDone( selected.length );
				close();
			};

			const close = () => {
				root.unmount();
				container.remove();
			};

			/* Adds Automatic Scroll for Selected Products */
			const scrollContainerRef = useRef( null );

			useEffect( () => {
				if ( scrollContainerRef.current ) {
					scrollContainerRef.current.scrollTo( {
						left: scrollContainerRef.current.scrollWidth,
						behavior: 'smooth',
					} );
				}
			}, [ selected ] );

			/* Fetches GODAM video for display */
			useEffect( () => {
				const fetchVideo = async () => {
					try {
						const modalEl = document.querySelector( '.godam-video-picker-modal' );
						const videoContainer = modalEl?.querySelector( '.godam-admin-video-add-to-product-container' );
						const spinner = modalEl?.querySelector( '.godam-admin-video-add-to-product-spinner' );
						const tooltip = modalEl?.querySelector( '.godam-admin-video-add-to-product-tooltip' );

						if ( ! videoContainer ) {
							return;
						}

						const response = await fetch( `/wp-json/godam/v1/video-shortcode?id=${ attachmentId }` );
						const data = await response.json();

						if ( data.status === 'success' && data.html ) {
							const tempDiv = document.createElement( 'div' );
							tempDiv.innerHTML = data.html;

							// Find and hide .animate-play-btn.
							const playBtn = tempDiv.querySelector( '.animate-play-btn' );
							if ( playBtn ) {
								playBtn.style.display = 'none';
							}

							// Update video container HTML.
							videoContainer.innerHTML = tempDiv.innerHTML;
							videoContainer.classList.remove( 'animate-video-loading' );

							if ( spinner ) {
								spinner.style.display = 'none';
							}

							tooltip.style.display = 'block';

							// Reinitialize player.
							if ( typeof GODAMPlayer === 'function' ) {
								GODAMPlayer( modalEl );

								const videoPlayer = modalEl.querySelector( '.video-js' );
								if ( videoPlayer && videoPlayer.player ) {
									videoPlayer.player.pause();
								}
							}
						}
					} catch ( error ) {
						// eslint-disable-next-line no-console
						console.error( 'Failed to fetch video', error );
					}
				};

				fetchVideo();
			}, [ attachmentId ] );

			/* ----- Fetch timestamps when selected products are loaded ----- */
			useEffect( () => {
				selected.forEach( ( p ) => {
					const input = document.getElementById( `timestamp_${ p.id }` );
					const attachment = attachmentId;

					if ( input ) {
						apiFetch( {
							path: `${ RTGodamVideoGallery.namespace }${ RTGodamVideoGallery.getTimestampEP }?product_id=${ p.id }&attachment_id=${ attachment }`,
						} ).then( ( res ) => {
							if ( res?.product_meta_value ) {
								input.value = res.product_meta_value;
							}
						} );
					}
				} );
			}, [ selected ] );

			return (
				<Modal
					title={ __( 'Attach video to other products', 'godam' ) }
					onRequestClose={ close }
					className="rt-godam-modal godam-video-picker-modal wc-godam-product-admin"
					style={ { top: '18%' } }
				>
					<div style={ { display: 'flex' } }>

						{ /* LEFT SIDE - Products */ }
						<div style={ { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '1px 15px 0 4px' } }>
							<div style={ { display: 'flex', gap: '8px', marginBottom: '0.5rem', width: '100%' } }>
								<div style={ { flex: 5 } }>
									<TextControl
										placeholder={ __( 'Search product by name, ID, category, tag or brand…', 'godam' ) }
										value={ search }
										onChange={ setSearch }
										className="godam-input"
										onKeyDown={ ( e ) => {
											if ( e.key === 'Enter' ) {
												e.preventDefault();
												doSearch();
											}
										} }
									/>
								</div>
								<Button className="components-button godam-button is-secondary wc-godam-product-admin" variant="secondary" onClick={ doSearch } aria-label={ __( 'Search', 'godam' ) } style={ {
									height: '86%',
								} }>
									<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
										<path d="M12.9 14.32a8 8 0 111.414-1.414l4.387 4.386-1.414 1.415-4.387-4.387zM8 14A6 6 0 108 2a6 6 0 000 12z" />
									</svg>
								</Button>
							</div>

							{ loading && <Spinner className="wc-godam-product-admin" /> }

							<ul style={ { maxHeight: '115px', overflowY: 'auto', listStyle: 'none', padding: 0 } }>
								{ results.map( ( p ) => {
									const isSelected = selected.includes( p );
									return (
										<li key={ p.id } className="wc-godam-product-admin" style={ { listStyle: 'none' } }>
											<button
												type="button"
												onClick={ () => toggleSelect( p ) }
												aria-label={ __( 'Select product:', 'godam' ) + ' ' + p.name }
												className="wc-godam-product-admin__item"
												style={ {
													display: 'flex',
													alignItems: 'center',
													width: '100%',
													padding: '6px 10px',
													background: isSelected
														? 'var(--wp-components-color-accent)'
														: 'transparent',
													borderRadius: '5px',
													color: isSelected ? '#ffffff' : '#000000',
													border: 'none',
													borderBottom: '1px solid #eee',
													cursor: 'pointer',
													textAlign: 'left',
												} }
											>
												<strong>{ p.name }</strong>
											</button>
										</li>
									);
								} ) }
							</ul>

							{ selected.length > 0 && (
								<div
									style={ {
										marginTop: '1rem',
										background: '#f8f8f8',
										padding: '10px',
										borderRadius: '4px',
									} }
								>
									<strong>{ __( 'Attach Products to Video:', 'godam' ) }</strong>

									<div
										ref={ scrollContainerRef }
										style={ {
											display: 'flex',
											overflowX: 'auto',
											gap: '12px',
											paddingTop: '10px',
											maxWidth: '100%',
										} }
									>
										{ selected
											.filter( ( p ) => p.id !== CURRENT_ID )
											.map( ( p ) => (
												<div
													key={ p.id }
													style={ {
														position: 'relative',
														display: 'flex',
														flexDirection: 'column',
														alignItems: 'center',
														width: '110px',
														minWidth: '100px',
														border: '1px solid #ddd',
														borderRadius: '6px',
														padding: '8px',
														background: '#fff',
														boxSizing: 'border-box',
														flexShrink: 0,
													} }
												>
													<button
														type="button"
														onClick={ () => {
															apiFetch( {
																path: `${ RTGodamVideoGallery.namespace }${ RTGodamVideoGallery.unLinkVideoEP }`,
																method: 'POST',
																data: {
																	product_id: p.id,
																	attachment_id: attachmentId,
																},
															} ).catch( () => {
																// eslint-disable-next-line no-alert
																window.alert( __( 'Failed to unlink video from product', 'godam' ) + ' ' + p.id );
															} );

															setSelected( ( prev ) => prev.filter( ( item ) => item.id !== p.id ) );
														} }
														style={ {
															position: 'absolute',
															top: '-9px',
															right: '-9px',
															background: '#f44336',
															color: '#fff',
															border: 'none',
															borderRadius: '50%',
															width: '20px',
															height: '20px',
															cursor: 'pointer',
															fontWeight: 'bold',
															lineHeight: '16px',
															fontSize: '14px',
															padding: 0,
														} }
														aria-label={ __( 'Remove product', 'godam' ) }
													>
														&times;
													</button>

													{ p.image && (
														<img
															src={ p.image }
															alt={ p.name }
															style={ {
																width: 64,
																height: 64,
																objectFit: 'cover',
																borderRadius: 4,
																marginBottom: 6,
															} }
														/>
													) }
													<span
														style={ {
															fontSize: '13px',
															textAlign: 'center',
															whiteSpace: 'nowrap',
															overflow: 'hidden',
															textOverflow: 'ellipsis',
															width: '100%',
														} }
													>
														{ p.name }
													</span>
													<div className="godam-product-timestamp-input" style={ {
														textAlign: 'center',
														marginTop: '8px',
													} }>
														<input
															type="text"
															name={ `timestamp_${ p.id }` }
															id={ `timestamp_${ p.id }` }
															placeholder="hh:mm:ss"
															style={ {
																fontSize: '13px',
																width: '86%',
																border: '1px solid #ddd',
																borderRadius: '10px',
																boxSizing: 'border-box',
																outline: 'none',
																backgroundColor: '#fff',
																textAlign: 'center',
															} }
														/>
													</div>
												</div>
											) ) }
									</div>
								</div>
							) }

							<div style={ {
								display: 'flex',
								justifyContent: 'space-between',
								alignItems: 'center',
								marginTop: '1rem',
								marginBottom: '2rem',
							} }>

								<Button
									variant="primary"
									disabled={ ! selected.length }
									onClick={ addToProducts }
									className="components-button ml-2 godam-button is-primary godam-margin-top-no-bottom wc-godam-product-admin"
									aria-label={ __( 'Save selected products', 'godam' ) }
								>
									{ __( 'Save', 'godam' ) }
								</Button>
							</div>
						</div>

						{ /* RIGHT SIDE - Video */ }
						<div style={ { flex: 1, borderLeft: '1px solid #ddd', paddingLeft: '15px', position: 'relative' } }>
							<Spinner className="godam-admin-video-add-to-product-spinner" style={ {
								position: 'absolute',
								top: '50%',
								left: '50%',
								transform: 'translate(-50%, -50%)',
								zIndex: 10,
							} } />

							<div className="godam-admin-video-add-to-product-container animate-video-loading"></div>

							<div
								className="godam-admin-video-add-to-product-tooltip"
								style={ {
									background: 'rgb(255, 244, 244)',
									border: '1px solid rgb(194, 0, 0)',
									borderRadius: '4px',
									padding: '8px',
									fontSize: '13px',
									color: 'rgb(194, 0, 0)',
									marginTop: '1rem',
									display: 'none',
								} }
							>
								{ __( 'Use the video to add timestamps for the products when they appear in the video.', 'godam' ) }
							</div>
						</div>
					</div>
				</Modal>
			);
		};

		const root = createRoot( container );
		root.render( <Picker /> );
	};
} );
