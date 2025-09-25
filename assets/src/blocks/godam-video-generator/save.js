import { __ } from '@wordpress/i18n';
import { useBlockProps } from '@wordpress/block-editor';
import './view.scss';

export default function Save( { attributes } )
{
    const {
        productImages = [],
        generatedVideoUrl = '',
        videoTitle = '',
        videoDescription = '',
        aiModel = 'runway',
        videoStyle = 'product-showcase',
        videoDuration = 15
    } = attributes;

    const blockProps = useBlockProps.save( {
        className: 'wp-block-godam-video-generator'
    } );

    // Don't render anything if no video is generated
    if ( !generatedVideoUrl )
    {
        return (
            <div { ...blockProps }>
                <div className="godam-video-generator-placeholder">
                    <div className="godam-placeholder-content">
                        <div className="godam-placeholder-icon">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                                <path
                                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        </div>
                        <h3>{ __( 'AI Video Generator', 'godam-video-generator' ) }</h3>
                        <p>{ __( 'Generate an advertisement video to display here.', 'godam-video-generator' ) }</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div { ...blockProps }>
            <div className="godam-video-generator-frontend">
                <div className="godam-video-wrapper">
                    { videoTitle && (
                        <h3 className="godam-video-title">{ videoTitle }</h3>
                    ) }

                    { videoDescription && (
                        <p className="godam-video-description">{ videoDescription }</p>
                    ) }

                    <div className="godam-video-container">
                        <video
                            controls
                            className="godam-generated-video"
                            poster=""
                            preload="metadata"
                        >
                            <source src={ generatedVideoUrl } type="video/mp4" />
                            <source src={ generatedVideoUrl.replace( '.mp4', '.webm' ) } type="video/webm" />
                            <p>{ __( 'Your browser does not support the video tag.', 'godam-video-generator' ) }</p>
                        </video>
                    </div>

                    <div className="godam-video-meta">
                        <div className="godam-video-info">
                            <span className="godam-meta-item">
                                <strong>{ __( 'Duration:', 'godam-video-generator' ) }</strong> { videoDuration }s
                            </span>
                            <span className="godam-meta-item">
                                <strong>{ __( 'Style:', 'godam-video-generator' ) }</strong> { videoStyle }
                            </span>
                            { productImages.length > 0 && (
                                <span className="godam-meta-item">
                                    <strong>{ __( 'Images:', 'godam-video-generator' ) }</strong> { productImages.length }
                                </span>
                            ) }
                        </div>
                    </div>

                    { productImages.length > 0 && (
                        <div className="godam-source-images">
                            <h4>{ __( 'Product Images Used:', 'godam-video-generator' ) }</h4>
                            <div className="godam-source-images-grid">
                                { productImages.slice( 0, 4 ).map( ( image, index ) => (
                                    <div key={ image.id } className="godam-source-image">
                                        <img
                                            src={ image.url }
                                            alt={ image.alt || `${ __( 'Product image', 'godam-video-generator' ) } ${ index + 1 }` }
                                            loading="lazy"
                                        />
                                    </div>
                                ) ) }
                                { productImages.length > 4 && (
                                    <div className="godam-source-image godam-more-images">
                                        <span>+{ productImages.length - 4 }</span>
                                    </div>
                                ) }
                            </div>
                        </div>
                    ) }

                    <div className="godam-video-actions">
                        <button
                            type="button"
                            className="godam-download-button"
                            onClick={ () => window.open( generatedVideoUrl, '_blank' ) }
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <path
                                    d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                            { __( 'Download Video', 'godam-video-generator' ) }
                        </button>

                        <button
                            type="button"
                            className="godam-share-button"
                            onClick={ () =>
                            {
                                if ( navigator.share )
                                {
                                    navigator.share( {
                                        title: videoTitle || __( 'AI Generated Video', 'godam-video-generator' ),
                                        text: videoDescription || __( 'Check out this AI-generated video!', 'godam-video-generator' ),
                                        url: window.location.href
                                    } );
                                } else
                                {
                                    // Fallback to copy to clipboard
                                    navigator.clipboard.writeText( window.location.href );
                                    alert( __( 'Link copied to clipboard!', 'godam-video-generator' ) );
                                }
                            } }
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                                <path
                                    d="M4 12v8a2 2 0 002 2h8M16 4v8a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2zM20 4v8a2 2 0 01-2 2h-8"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                            { __( 'Share', 'godam-video-generator' ) }
                        </button>
                    </div>

                    <div className="godam-powered-by">
                        <small>{ __( 'Powered by AI Video Generation', 'godam-video-generator' ) }</small>
                    </div>
                </div>
            </div>
        </div>
    );
}