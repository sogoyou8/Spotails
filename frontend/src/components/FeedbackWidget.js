import React, { useState } from 'react';

const FeedbackWidget = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [feedback, setFeedback] = useState('');
    const [rating, setRating] = useState(0);
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Simuler l'envoi du feedback
        console.log('Feedback soumis:', { rating, feedback });
        
        setSubmitted(true);
        setTimeout(() => {
            setIsOpen(false);
            setSubmitted(false);
            setFeedback('');
            setRating(0);
        }, 2000);
    };

    return (
        <>
            {/* Bouton flottant */}
            <button
                className="btn btn-primary position-fixed"
                style={{
                    bottom: '20px',
                    right: '20px',
                    borderRadius: '50px',
                    zIndex: 1000,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                }}
                onClick={() => setIsOpen(true)}
                title="Donner votre avis"
            >
                <i className="bi bi-chat-dots"></i>
            </button>

            {/* Modal de feedback */}
            {isOpen && (
                <div className="modal d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog">
                        <div className="modal-content">
                            <div className="modal-header">
                                <h5 className="modal-title">Votre avis nous intéresse</h5>
                                <button
                                    type="button"
                                    className="btn-close"
                                    onClick={() => setIsOpen(false)}
                                ></button>
                            </div>
                            <div className="modal-body">
                                {submitted ? (
                                    <div className="text-center">
                                        <i className="bi bi-check-circle text-success" style={{ fontSize: '3rem' }}></i>
                                        <h4 className="mt-3">Merci pour votre retour !</h4>
                                        <p>Votre avis nous aide à améliorer Spotails.</p>
                                    </div>
                                ) : (
                                    <form onSubmit={handleSubmit}>
                                        <div className="mb-3">
                                            <label className="form-label">Note globale</label>
                                            <div className="d-flex gap-2">
                                                {[1, 2, 3, 4, 5].map(star => (
                                                    <button
                                                        key={star}
                                                        type="button"
                                                        className="btn btn-link p-0"
                                                        onClick={() => setRating(star)}
                                                        style={{ fontSize: '1.5rem', color: star <= rating ? '#ffc107' : '#ccc' }}
                                                    >
                                                        <i className="bi bi-star-fill"></i>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        
                                        <div className="mb-3">
                                            <label className="form-label">Commentaire (optionnel)</label>
                                            <textarea
                                                className="form-control"
                                                rows="3"
                                                value={feedback}
                                                onChange={(e) => setFeedback(e.target.value)}
                                                placeholder="Que pensez-vous de l'expérience Spotails ?"
                                            ></textarea>
                                        </div>
                                        
                                        <div className="d-flex justify-content-end gap-2">
                                            <button
                                                type="button"
                                                className="btn btn-secondary"
                                                onClick={() => setIsOpen(false)}
                                            >
                                                Annuler
                                            </button>
                                            <button
                                                type="submit"
                                                className="btn btn-primary"
                                                disabled={rating === 0}
                                            >
                                                Envoyer
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default FeedbackWidget;