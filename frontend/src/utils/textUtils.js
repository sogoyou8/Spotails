import React from "react";

export const formatRecipeText = (text) => {
    const parts = text.split(/(\*+[^*]+\*+)/g);

    return parts.map((part, index) => {
        const match = part.match(/^\*+([^*]+)\*+$/);
        if (match) {
            const starCount = (part.match(/^\*+/)[0].length);
            if (starCount === 1) {
                return (
                    <strong key={index}>
                        {match[1]}
                    </strong>
                );
            } else {
                const baseSize = 1;
                const sizeIncrement = 0.3;
                const fontSize = `${baseSize + sizeIncrement * starCount}rem`;
                return (
                    <strong key={index} style={{ fontSize }}>
                        {match[1]}
                    </strong>
                );
            }
        } else {
            return part;
        }
    });
};