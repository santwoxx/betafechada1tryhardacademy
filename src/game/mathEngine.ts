export type Difficulty = 'easy' | 'medium' | 'hard';

export interface Question {
    text: string;
    options: number[];
    answer: number;
    explanation: string;
    difficulty: Difficulty;
}

export class MathEngine {
    private static instance: MathEngine;
    private performanceHistory: { correct: boolean; difficulty: Difficulty }[] = [];

    private constructor() {}

    static getInstance(): MathEngine {
        if (!MathEngine.instance) {
            MathEngine.instance = new MathEngine();
        }
        return MathEngine.instance;
    }

    recordPerformance(correct: boolean, difficulty: Difficulty) {
        this.performanceHistory.push({ correct, difficulty });
        if (this.performanceHistory.length > 20) {
            this.performanceHistory.shift();
        }
    }

    getSuggestedDifficulty(): Difficulty {
        if (this.performanceHistory.length < 3) return 'easy';

        const recent = this.performanceHistory.slice(-5);
        const correctCount = recent.filter(p => p.correct).length;
        const accuracy = correctCount / recent.length;

        const currentDifficulty = recent[recent.length - 1].difficulty;

        if (accuracy >= 0.8) {
            if (currentDifficulty === 'easy') return 'medium';
            if (currentDifficulty === 'medium') return 'hard';
            return 'hard';
        } else if (accuracy <= 0.4) {
            if (currentDifficulty === 'hard') return 'medium';
            if (currentDifficulty === 'medium') return 'easy';
            return 'easy';
        }

        return currentDifficulty;
    }

    getStats() {
        const total = this.performanceHistory.length;
        const correct = this.performanceHistory.filter(p => p.correct).length;
        const byDifficulty = {
            easy: this.performanceHistory.filter(p => p.difficulty === 'easy').length,
            medium: this.performanceHistory.filter(p => p.difficulty === 'medium').length,
            hard: this.performanceHistory.filter(p => p.difficulty === 'hard').length,
        };
        
        return {
            total,
            correct,
            accuracy: total > 0 ? (correct / total) * 100 : 0,
            byDifficulty
        };
    }

    generateQuestion(difficulty?: Difficulty): Question {
        const diff = difficulty || this.getSuggestedDifficulty();
        
        switch (diff) {
            case 'hard':
                return this.generateHardQuestion();
            case 'medium':
                return this.generateMediumQuestion();
            case 'easy':
            default:
                return this.generateEasyQuestion();
        }
    }

    private generateEasyQuestion(): Question {
        const isAddition = Math.random() > 0.5;
        let a, b, answer, text, explanation;

        if (isAddition) {
            a = Math.floor(Math.random() * 30) + 1;
            b = Math.floor(Math.random() * 30) + 1;
            answer = a + b;
            text = `${a} + ${b}`;
            explanation = `${a} mais ${b} resulta em ${answer}.`;
        } else {
            a = Math.floor(Math.random() * 50) + 10;
            b = Math.floor(Math.random() * a) + 1;
            answer = a - b;
            text = `${a} - ${b}`;
            explanation = `Subtraindo ${b} de ${a}, restam ${answer}.`;
        }

        return {
            text,
            answer,
            options: this.generateOptions(answer),
            explanation,
            difficulty: 'easy'
        };
    }

    private generateMediumQuestion(): Question {
        const isMultiplication = Math.random() > 0.4;
        let a, b, answer, text, explanation;

        if (isMultiplication) {
            a = Math.floor(Math.random() * 12) + 2;
            b = Math.floor(Math.random() * 10) + 2;
            answer = a * b;
            text = `${a} × ${b}`;
            explanation = `${a} vezes ${b} é igual a ${answer}.`;
        } else {
            b = Math.floor(Math.random() * 10) + 2;
            answer = Math.floor(Math.random() * 10) + 2;
            a = b * answer;
            text = `${a} ÷ ${b}`;
            explanation = `${a} dividido por ${b} dá ${answer}.`;
        }

        return {
            text,
            answer,
            options: this.generateOptions(answer),
            explanation,
            difficulty: 'medium'
        };
    }

    private generateHardQuestion(): Question {
        // Expressions like a + b * c or (a + b) * c
        const type = Math.floor(Math.random() * 3);
        let a, b, c, answer, text, explanation;

        if (type === 0) {
            // a + b * c
            b = Math.floor(Math.random() * 8) + 2;
            c = Math.floor(Math.random() * 6) + 2;
            a = Math.floor(Math.random() * 20) + 1;
            answer = a + (b * c);
            text = `${a} + ${b} × ${c}`;
            explanation = `Primeiro multiplicamos: ${b} × ${c} = ${b * c}. Depois somamos: ${a} + ${b * c} = ${answer}.`;
        } else if (type === 1) {
            // a * b - c
            a = Math.floor(Math.random() * 10) + 2;
            b = Math.floor(Math.random() * 8) + 2;
            c = Math.floor(Math.random() * (a * b - 1)) + 1;
            answer = (a * b) - c;
            text = `${a} × ${b} - ${c}`;
            explanation = `Primeiro multiplicamos: ${a} × ${b} = ${a * b}. Depois subtraímos: ${a * b} - ${c} = ${answer}.`;
        } else {
            // (a + b) * c
            a = Math.floor(Math.random() * 10) + 1;
            b = Math.floor(Math.random() * 10) + 1;
            c = Math.floor(Math.random() * 5) + 2;
            answer = (a + b) * c;
            text = `(${a} + ${b}) × ${c}`;
            explanation = `Primeiro resolvemos os parênteses: ${a} + ${b} = ${a + b}. Depois multiplicamos: ${a + b} × ${c} = ${answer}.`;
        }

        return {
            text,
            answer,
            options: this.generateOptions(answer),
            explanation,
            difficulty: 'hard'
        };
    }

    private generateOptions(answer: number): number[] {
        const options = new Set<number>();
        options.add(answer);

        while (options.size < 4) {
            let offset;
            const rand = Math.random();
            
            if (rand < 0.3) {
                // Close numbers
                offset = Math.floor(Math.random() * 6) - 3;
            } else if (rand < 0.6) {
                // Common mistakes (off by 10)
                offset = (Math.random() > 0.5 ? 10 : -10);
            } else {
                // Random but related
                offset = Math.floor(Math.random() * 20) - 10;
            }

            const opt = answer + offset;
            if (opt >= 0 && opt !== answer) {
                options.add(opt);
            }
        }

        return Array.from(options).sort(() => Math.random() - 0.5);
    }
}
