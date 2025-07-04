/**
 * External dependencies
 */
import clsx from 'clsx';

/**
 * WordPress dependencies
 */
import { useState, useEffect, useCallback } from '@wordpress/element';
import { usePrevious } from '@wordpress/compose';
import { __ } from '@wordpress/i18n';
import {
	BlockControls,
} from '@wordpress/block-editor';
import { TextControl, ToolbarButton } from '@wordpress/components';
import { caption as captionIcon } from '@wordpress/icons';

export function Caption( {
	attributeKey = 'caption',
	attributes,
	setAttributes,
	isSelected,
	insertBlocksAfter,
	placeholder = __( 'Add caption', 'godam' ),
	label = __( 'Caption text', 'godam' ),
	showToolbarButton = true,
	excludeElementClassName,
	className,
	tagName = 'figcaption',
	addLabel = __( 'Add caption', 'godam' ),
	removeLabel = __( 'Remove caption', 'godam' ),
	icon = captionIcon,
	...props
} ) {
	const caption = attributes[ attributeKey ];
	const prevCaption = usePrevious( caption );
	const isCaptionEmpty = caption === '';
	const isPrevCaptionEmpty = prevCaption === '';
	const [ showCaption, setShowCaption ] = useState( ! isCaptionEmpty );

	useEffect( () => {
		if ( ! isCaptionEmpty && isPrevCaptionEmpty ) {
			setShowCaption( true );
		}
	}, [ isCaptionEmpty, isPrevCaptionEmpty ] );

	useEffect( () => {
		if ( ! isSelected && isCaptionEmpty ) {
			setShowCaption( false );
		}
	}, [ isSelected, isCaptionEmpty ] );

	// Focus the caption when we click to add one.
	const ref = useCallback(
		( node ) => {
			if ( node && isCaptionEmpty ) {
				node.focus();
			}
		},
		[ isCaptionEmpty ],
	);

	return (
		<>
			{ showToolbarButton && (
				<BlockControls group="block">
					<ToolbarButton
						onClick={ () => {
							setShowCaption( ! showCaption );
							if ( showCaption && caption ) {
								setAttributes( {
									[ attributeKey ]: undefined,
								} );
							}
						} }
						icon={ icon }
						isPressed={ showCaption }
						label={ showCaption ? removeLabel : addLabel }
					/>
				</BlockControls>
			) }
			{ showCaption && (
				<TextControl
					identifier={ attributeKey }
					tagName={ tagName }
					className={ clsx(
						className,
						excludeElementClassName
							? ''
							: 'rtgodam-video-caption',
					) }
					ref={ ref }
					aria-label={ label }
					placeholder={ placeholder }
					value={ caption }
					onChange={ ( value ) => {
						setAttributes( { [ attributeKey ]: value } );
					} }
					{ ...props }
				/>
			) }
		</>
	);
}
