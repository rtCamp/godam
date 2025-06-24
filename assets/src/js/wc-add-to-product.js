/* global jQuery, RTGodamVideoGallery */
/**
 * WordPress dependencies
 */
import apiFetch from '@wordpress/api-fetch';
import { render } from '@wordpress/element';
import {
	Modal,
	TextControl,
	Button,
	Spinner,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import Ptag from '../images/product-tag.svg';

jQuery( document ).ready( function( $ ) {
	const videoList = $( '.godam-product-video-gallery-list' );

	const tagIconSVG = `<img src="${ Ptag }"
    alt="${ wp.i18n.__( 'Product tag', 'godam' ) }"
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
				$button.html( `${ tagIconSVG }&nbsp;${ count } product${ count > 1 ? 's' : '' }` );
			} else {
				$button.text( '+ Add Products' );
			}
		}, $button, $li );
	} );

	const selectedProductsMap = new Map();

	/* ---------- Modal implementation ---------- */
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

			const addToProducts = () => {
				selected.forEach( ( product ) => {
					if ( product.id === CURRENT_ID ) {
						return;
					}
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
						window.alert( 'Failed to link video to product ' + product.id );
					} );
				} );

				selectedProductsMap.set( attachmentId, selected );

				$button.attr( 'data-linked-products', JSON.stringify( selected ) );

				onDone( selected.length );
				close();
			};

			const close = () => {
				render( null, container );
				container.remove();
			};

			return (
				<Modal title="Attach video to other products" onRequestClose={ close } className="rt-godam-modal godam-video-picker-modal">
					<div style={ { display: 'flex', gap: '8px', marginBottom: '1rem' } }>
						<div style={ { flex: 1 } }>
							<TextControl
								placeholder="Search product by name, ID, category, tag or brand…"
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
						<Button className="components-button godam-button is-secondary wc-godam-product-admin" variant="secondary" onClick={ doSearch } aria-label="Search" style={ {
							height: '100%',
						} }>
							<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 20 20">
								<path d="M12.9 14.32a8 8 0 111.414-1.414l4.387 4.386-1.414 1.415-4.387-4.387zM8 14A6 6 0 108 2a6 6 0 000 12z" />
							</svg>
						</Button>
					</div>

					{ loading && <Spinner className="wc-godam-product-admin" /> }

					<ul style={ { maxHeight: '250px', overflowY: 'auto', listStyle: 'none', padding: 0 } }>
						{ results.map( ( p ) => {
							const isSelected = selected.includes( p );
							return (
								<li key={ p.id } className="wc-godam-product-admin" style={ { listStyle: 'none' } }>
									<button
										type="button"
										onClick={ () => toggleSelect( p ) }
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
							<strong>Attach Products to Video:</strong>

							<div
								style={ {
									display: 'flex',
									overflowX: 'auto',
									gap: '12px',
									paddingTop: '10px',
								} }
							>
								{ selected
									.filter( ( p ) => p.id !== CURRENT_ID )
									.map( ( p ) => (
										<div
											key={ p.id }
											style={ {
												display: 'flex',
												flexDirection: 'column',
												alignItems: 'center',
												width: '110px',
												minWidth: '100px',
												height: '130px',
												border: '1px solid #ddd',
												borderRadius: '6px',
												padding: '8px',
												background: '#fff',
												boxSizing: 'border-box',
												flexShrink: 0,
											} }
										>
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
										</div>
									) ) }
							</div>
						</div>
					) }

					<div style={ { marginTop: '1rem' } }>
						<Button
							variant="primary"
							disabled={ ! selected.length }
							onClick={ addToProducts }
							className="components-button ml-2 godam-button is-primary godam-margin-top-no-bottom wc-godam-product-admin"
						>
							Add&nbsp;product{ selected.length > 1 ? 's' : '' }
						</Button>
					</div>
				</Modal>
			);
		};

		render( <Picker />, container );
	};
} );
