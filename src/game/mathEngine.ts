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
    private recentQuestionTexts: string[] = [];
    private readonly MAX_RECENT = 8;
    private readonly MAX_HISTORY = 20;

    private constructor() {}

    static getInstance(): MathEngine {
        if (!MathEngine.instance) {
            MathEngine.instance = new MathEngine();
        }
        return MathEngine.instance;
    }

    recordPerformance(correct: boolean, difficulty: Difficulty): void {
        this.performanceHistory.push({ correct, difficulty });
        if (this.performanceHistory.length > this.MAX_HISTORY) {
            this.performanceHistory.shift();
        }
    }

    getSuggestedDifficulty(): Difficulty {
        if (this.performanceHistory.length < 4) {
            return 'easy';
        }

        const recent = this.performanceHistory.slice(-8);
        const correctCount = recent.filter(p => p.correct).length;
        const accuracy = correctCount / recent.length;

        const lastDifficulty = recent[recent.length - 1].difficulty;

        // More stable adaptive logic
        if (accuracy >= 0.78) {
            if (lastDifficulty === 'easy') return 'medium';
            if (lastDifficulty === 'medium') return 'hard';
            return 'hard';
        } 
        if (accuracy <= 0.42) {
            if (lastDifficulty === 'hard') return 'medium';
            if (lastDifficulty === 'medium') return 'easy';
            return 'easy';
        }

        return lastDifficulty;
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
            accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
            byDifficulty
        };
    }

    generateQuestion(difficulty?: Difficulty): Question {
        const targetDifficulty = difficulty || this.getSuggestedDifficulty();
        
        let question: Question;
        let attempts = 0;
        const maxAttempts = 12;

        do {
            switch (targetDifficulty) {
                case 'hard':
                    question = this.generateHardQuestion();
                    break;
                case 'medium':
                    question = this.generateMediumQuestion();
                    break;
                case 'easy':
                default:
                    question = this.generateEasyQuestion();
            }
            attempts++;
        } while (this.recentQuestionTexts.includes(question.text) && attempts < maxAttempts);

        // Update recent questions to avoid repetition
        this.recentQuestionTexts.push(question.text);
        if (this.recentQuestionTexts.length > this.MAX_RECENT) {
            this.recentQuestionTexts.shift();
        }

        return question;
    }

    private generateEasyQuestion(): Question {
        const operations = ['add', 'subtract'] as const;
        const op = operations[Math.floor(Math.random() * operations.length)];

        let a: number, b: number, answer: number, text: string, explanation: string;

        if (op === 'add') {
            a = Math.floor(Math.random() * 25) + 5;
            b = Math.floor(Math.random() * 25) + 5;
            answer = a + b;
            text = `${a} + ${b}`;
            explanation = `${a} mais ${b} é igual a ${answer}.`;
        } else {
            a = Math.floor(Math.random() * 40) + 15;
            b = Math.floor(Math.random() * 20) + 5;
            answer = a - b;
            text = `${a} - ${b}`;
            explanation = `Subtraindo ${b} de ${a} resulta em ${answer}.`;
        }

        return {
            text,
            options: this.generateOptions(answer, 'easy'),
            answer,
            explanation,
            difficulty: 'easy'
        };
    }

    private generateMediumQuestion(): Question {
        const operations = ['multiply', 'divide'] as const;
        const op = operations[Math.floor(Math.random() * operations.length)];

        let a: number, b: number, answer: number, text: string, explanation: string;

        if (op === 'multiply') {
            a = Math.floor(Math.random() * 9) + 3;
            b = Math.floor(Math.random() * 9) + 3;
            answer = a * b;
            text = `${a} × ${b}`;
            explanation = `${a} multiplicado por ${b} resulta em ${answer}.`;
        } else {
            b = Math.floor(Math.random() * 8) + 3;
            answer = Math.floor(Math.random() * 9) + 4;
            a = b * answer;
            text = `${a} ÷ ${b}`;
            explanation = `${a} dividido por ${b} é igual a ${answer}.`;
        }

        return {
            text,
            options: this.generateOptions(answer, 'medium'),
            answer,
            explanation,
            difficulty: 'medium'
        };
    }

    private generateHardQuestion(): Question {
        const types = [0, 1, 2] as const;
        const type = types[Math.floor(Math.random() * types.length)];

        let a: number, b: number, c: number, answer: number, text: string, explanation: string;

        if (type === 0) { // a + b × c
            a = Math.floor(Math.random() * 18) + 5;
            b = Math.floor(Math.random() * 7) + 3;
            c = Math.floor(Math.random() * 6) + 3;
            answer = a + (b * c);
            text = `${a} + ${b} × ${c}`;
            explanation = `Multiplicação primeiro: ${b} × ${c} = ${b*c}. Depois ${a} + ${b*c} = ${answer}.`;
        } else if (type === 1) { // a × b - c
            a = Math.floor(Math.random() * 8) + 3;
            b = Math.floor(Math.random() * 7) + 3;
            c = Math.floor(Math.random() * 12) + 4;
            answer = (a * b) - c;
            text = `${a} × ${b} - ${c}`;
            explanation = `Primeiro ${a} × ${b} = ${a*b}. Depois ${a*b} - ${c} = ${answer}.`;
        } else { // (a + b) × c
            a = Math.floor(Math.random() * 12) + 3;
            b = Math.floor(Math.random() * 10) + 3;
            c = Math.floor(Math.random() * 5) + 3;
            answer = (a + b) * c;
            text = `(${a} + ${b}) × ${c}`;
            explanation = `Parênteses primeiro: ${a} + ${b} = ${a+b}. Depois multiplicado por ${c} = ${answer}.`;
        }

        return {
            text,
            options: this.generateOptions(answer, 'hard'),
            answer,
            explanation,
            difficulty: 'hard'
        };
    }

    private generateOptions(answer: number, difficulty: Difficulty): number[] {
        const options = new Set<number>([answer]);
        let range: number;

        switch (difficulty) {
            case 'easy':
                range = 12;
                break;
            case 'medium':
                range = 20;
                break;
            case 'hard':
                range = 30;
                break;
        }

        // Close values (very plausible mistakes)
        const closeOffsets = [-2, -1, 1, 2, -5, 5];
        for (const offset of closeOffsets) {
            if (options.size >= 4) break;
            const candidate = answer + offset;
            if (candidate >= 0) options.add(candidate);
        }

        // Common calculation errors
        if (difficulty !== 'easy') {
            if (options.size < 4) options.add(answer * 2);
            if (options.size < 4 && answer > 4) options.add(Math.floor(answer / 2));
        }

        // Larger variations
        while (options.size < 4) {
            const offset = Math.floor(Math.random() * range * 2) - range;
            const candidate = answer + offset;
            if (candidate >= 0 && candidate !== answer) {
                options.add(candidate);
            }
        }

        // Convert to array and shuffle
        const optionArray = Array.from(options).slice(0, 4);
        return optionArray.sort(() => Math.random() - 0.5);
    }
}