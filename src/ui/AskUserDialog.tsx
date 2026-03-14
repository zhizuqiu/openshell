import React, { useState, useMemo } from "react";
import { Box, Text, useInput } from "ink";
import { questionManager } from "../core/question.js";
import type { QuestionRequest, QuestionOption } from "../core/question.js";

/**
 * 进度条/标签页显示
 */
const TabHeader: React.FC<{
  questions: QuestionRequest["questions"];
  currentIndex: number;
  answeredIndices: Set<number>;
}> = ({ questions, currentIndex, answeredIndices }) => {
  return (
    <Box marginBottom={1} flexDirection="row">
      {questions.map((q, i) => {
        const isCurrent = i === currentIndex;
        const isAnswered = answeredIndices.has(i);
        return (
          <Box key={i} marginRight={2}>
            <Text
              bold={isCurrent}
              color={isCurrent ? "cyan" : isAnswered ? "green" : "gray"}
              underline={isCurrent}
            >
              {isAnswered ? "✓ " : ""}{q.header}
            </Text>
          </Box>
        );
      })}
      {questions.length > 1 && (
        <Box key="review">
          <Text
            bold={currentIndex === questions.length}
            color={currentIndex === questions.length ? "cyan" : "gray"}
            underline={currentIndex === questions.length}
          >
            Review
          </Text>
        </Box>
      )}
    </Box>
  );
};

/**
 * 文本输入视图
 */
const TextQuestionView: React.FC<{
  question: string;
  placeholder?: string;
  initialValue?: string;
  onAnswer: (val: string) => void;
}> = ({ question, placeholder, initialValue, onAnswer }) => {
  const [value, setValue] = useState(initialValue || "");

  useInput((input, key) => {
    if (key.return) {
      onAnswer(value);
    } else if (key.backspace || key.delete) {
      setValue(prev => prev.slice(0, -1));
    } else if (
      key.tab ||
      key.leftArrow ||
      key.rightArrow ||
      key.upArrow ||
      key.downArrow ||
      input === "\t"
    ) {
      // 明确忽略所有导航键和 Tab 字符，防止它们被添加到 value 中
      return;
    } else if (input && !key.ctrl && !key.meta && !key.escape) {
      setValue(prev => prev + input);
    }
  });

  return (
    <Box flexDirection="column">
      <Text bold>{question}</Text>
      <Box marginTop={1} flexDirection="row">
        <Text color="cyan">{"> "}</Text>
        {value.length === 0 ? (
          <Text color="gray">{placeholder || "Type your answer..."}</Text>
        ) : (
          <Text>{value}</Text>
        )}
      </Box>
    </Box>
  );
};

/**
 * 选择视图 (支持单选/多选/yesno)
 */
const ChoiceQuestionView: React.FC<{
  question: string;
  options: QuestionOption[];
  multiple?: boolean;
  initialValues?: string[];
  onAnswer: (vals: string[]) => void;
}> = ({ question, options, multiple, initialValues, onAnswer }) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    new Set(initialValues ? options.map((opt, i) => initialValues.includes(opt.label) ? i : -1).filter(i => i !== -1) : [])
  );

  useInput((input, key) => {
    if (key.upArrow) {
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : options.length - 1));
    } else if (key.downArrow) {
      setSelectedIndex(prev => (prev < options.length - 1 ? prev + 1 : 0));
    } else if (key.leftArrow || key.rightArrow || key.tab) {
      // 忽略导航键，由父组件处理切换
      return;
    } else if (key.return) {
      if (multiple) {
        // 多选模式下回车触发“完成”或勾选？这里简化为“回车提交”或增加一个“Done”选项
        onAnswer(Array.from(selectedIndices).map(i => options[i]!.label));
      } else {
        onAnswer([options[selectedIndex]!.label]);
      }
    } else if (multiple && input === " ") {
      setSelectedIndices(prev => {
        const next = new Set(prev);
        if (next.has(selectedIndex)) next.delete(selectedIndex);
        else next.add(selectedIndex);
        return next;
      });
    }
  });

  return (
    <Box flexDirection="column">
      <Text bold>{question} {multiple && <Text color="gray">(Space to select multiple, Enter to confirm)</Text>}</Text>
      <Box marginTop={1} flexDirection="column">
        {options.map((opt, i) => {
          const isFocused = i === selectedIndex;
          const isChecked = selectedIndices.has(i);
          return (
            <Box key={i} flexDirection="column">
              <Box flexDirection="row">
                <Text color={isFocused ? "cyan" : "white"}>
                  {isFocused ? "❯ " : "  "}
                  {multiple ? `[${isChecked ? "x" : " "}] ` : ""}
                  {opt.label}
                </Text>
              </Box>
              {isFocused && opt.description && (
                <Box marginLeft={4}>
                  <Text color="gray" italic>{opt.description}</Text>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

/**
 * 预览审查视图
 */
const ReviewView: React.FC<{
  questions: QuestionRequest["questions"];
  answers: Map<number, string[]>;
  onSubmit: () => void;
}> = ({ questions, answers, onSubmit }) => {
  useInput((_input, key) => {
    if (key.return) {
      onSubmit();
    }
  });

  return (
    <Box flexDirection="column">
      <Text bold color="yellow">Review your answers:</Text>
      <Box marginTop={1} flexDirection="column">
        {questions.map((q, i) => {
          const ans = answers.get(i);
          return (
            <Box key={i} marginBottom={1}>
              <Text color="gray" dimColor>{q.header}: </Text>
              <Text color={ans ? "white" : "red"}>{ans ? ans.join(", ") : "(unanswered)"}</Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

/**
 * 主对话框容器
 */
export const AskUserDialog: React.FC<{
  request: QuestionRequest;
  onFinished: () => void;
}> = ({ request, onFinished }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<number, string[]>>(new Map());

  const answeredIndices = useMemo(() => new Set(answers.keys()), [answers]);
  const isReviewMode = currentIndex === request.questions.length;

  const handleAnswer = (val: string | string[]) => {
    const newVal = Array.isArray(val) ? val : [val];
    setAnswers(prev => new Map(prev).set(currentIndex, newVal));

    if (request.questions.length > 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      // 只有一个问题，答完直接提交
      questionManager.submit({
        requestId: request.id,
        answers: [newVal]
      });
      onFinished();
    }
  };

  const handleFinalSubmit = () => {
    const finalAnswers = request.questions.map((_, i) => answers.get(i) || []);
    questionManager.submit({
      requestId: request.id,
      answers: finalAnswers
    });
    onFinished();
  };

  useInput((_input, key) => {
    if (key.escape) {
      questionManager.cancel(request.id);
      onFinished();
    } else if (key.tab && key.shift) {
      if (currentIndex > 0) setCurrentIndex(prev => prev - 1);
    } else if (key.tab) {
      if (currentIndex < request.questions.length && (answeredIndices.has(currentIndex) || currentIndex < request.questions.length - 1)) {
        setCurrentIndex(prev => prev + 1);
      }
    } else if (key.leftArrow) {
      if (currentIndex > 0) setCurrentIndex(prev => prev - 1);
    } else if (key.rightArrow) {
      if (currentIndex < request.questions.length && (answeredIndices.has(currentIndex) || currentIndex < request.questions.length - 1)) {
        setCurrentIndex(prev => prev + 1);
      }
    }
  });

  if (isReviewMode) {
    return (
      <Box flexDirection="column" padding={1} borderStyle="round" borderColor="cyan" borderDimColor={true} width={(process.stdout.columns || 80) - 4}>
        <TabHeader questions={request.questions} currentIndex={currentIndex} answeredIndices={answeredIndices} />
        <ReviewView questions={request.questions} answers={answers} onSubmit={handleFinalSubmit} />
        <Box marginTop={1} flexDirection="column">
          <Text color="gray" dimColor>
            Tab/Shift+Tab/← to edit answers | Esc to cancel
          </Text>
          <Text color="cyan" bold>Press Enter to submit everything</Text>
        </Box>
      </Box>
    );
  }

  const q = request.questions[currentIndex]!;
  
  return (
    <Box flexDirection="column" padding={1} borderStyle="round" borderColor="cyan" borderDimColor={true} width={(process.stdout.columns || 80) - 4}>
      <TabHeader questions={request.questions} currentIndex={currentIndex} answeredIndices={answeredIndices} />
      
      {q.type === "text" && (
        <TextQuestionView
          key={currentIndex}
          question={q.question}
          placeholder={q.placeholder}
          initialValue={answers.get(currentIndex)?.[0]}
          onAnswer={handleAnswer}
        />
      )}

      {(q.type === "choice" || q.type === "yesno") && (
        <ChoiceQuestionView
          key={currentIndex}
          question={q.question}
          options={q.type === "yesno" ? [{label: "Yes", description: ""}, {label: "No", description: ""}] : (q.options || [])}
          multiple={q.multiple}
          initialValues={answers.get(currentIndex)}
          onAnswer={handleAnswer}
        />
      )}

      <Box marginTop={1} flexDirection="column">
        <Text color="gray" dimColor>
          {currentIndex > 0 ? "Tab/← Prev | " : ""}
          {answeredIndices.has(currentIndex) || currentIndex < request.questions.length - 1 ? "Tab/→ Next | " : ""}
          Esc to cancel
        </Text>
        <Text color="cyan" bold>
          Press Enter to {q.type === "text" ? "confirm answer" : "select option"}
        </Text>
      </Box>
    </Box>
  );
};
