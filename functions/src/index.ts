import * as admin from "firebase-admin";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import {defineString} from "firebase-functions/params";

import OpenAI from "openai";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import {APIError} from "openai/error";
import {
  ChatCompletionCreateParamsNonStreaming,
} from "openai/resources/chat/completions";

admin.initializeApp();

// --- Configuração OpenAI ---
const openAIKeyParam = defineString("OPENAI_KEY");

let openai: OpenAI | null = null;
try {
  const key = openAIKeyParam.value();
  if (key && key !== "") {
    openai = new OpenAI({apiKey: key});
    logger.info("Cliente OpenAI inicializado via parâmetro OPENAI_KEY.");
  } else {
    logger.error(
      "Erro crítico: Parâmetro OPENAI_KEY não definido ou vazio."
    );
  }
} catch (e) {
  logger.error(
    "Falha ao acessar parâmetro OPENAI_KEY ou inicializar OpenAI:",
    e
  );
}

// --- Interface para summarizeText ---
interface SummarizeTextData {
  text: string;
}
interface SummarizeTextResponse {
  summary: string;
}

// --- Cloud Function: summarizeText ---
export const summarizeText = onCall<
  SummarizeTextData,
  Promise<SummarizeTextResponse>
>(
  {/* options */},
  async (request): Promise<SummarizeTextResponse> => {
    if (!request.auth) {
      logger.warn("Chamada não autenticada para summarizeText.");
      throw new HttpsError("unauthenticated", "Usuário não autenticado.");
    }
    const uid = request.auth.uid;

    const textToSummarize = request.data.text;
    if (
      !textToSummarize ||
      typeof textToSummarize !== "string" ||
      textToSummarize.trim().length === 0
    ) {
      logger.warn("Argumento inválido para summarizeText.", {
        uid,
        data: request.data,
      });
      throw new HttpsError(
        "invalid-argument",
        "Texto para resumir não fornecido ou inválido."
      );
    }

    if (!openai) {
      logger.error("Cliente OpenAI não inicializado.", {uid});
      throw new HttpsError(
        "internal",
        "Erro interno: IA não configurada corretamente."
      );
    }

    logger.info(`Pedido de resumo para usuário: ${uid}`, {
      textLength: textToSummarize.length,
    });

    try {
      logger.info("Chamando API da OpenAI (summarizeText)...", {uid});
      const params: ChatCompletionCreateParamsNonStreaming = {
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              "Você é um assistente útil especializado em resumir textos " +
              "jurídicos de forma concisa e clara, mantendo os pontos " +
              "chave e a linguagem formal apropriada.",
          },
          {
            role: "user",
            content:
              "Por favor, resuma o seguinte texto:\n\n" +
              `"${textToSummarize}"\n\n` +
              "Resumo Conciso:",
          },
        ],
        temperature: 0.5,
        max_tokens: 150,
      };
      const completion = await openai.chat.completions.create(params);
      logger.info("Resposta da OpenAI recebida (summarizeText).", {uid});
      const summaryContent = completion.choices[0]?.message?.content?.trim();

      if (!summaryContent) {
        logger.error("Resposta da OpenAI vazia (summarizeText).", {uid});
        throw new HttpsError(
          "internal",
          "Não foi possível gerar o resumo."
        );
      }
      logger.info("Retornando resumo (summarizeText).", {
        uid,
        summaryLength: summaryContent.length,
      });
      return {summary: summaryContent};
    } catch (error: unknown) {
      logger.error("Erro API OpenAI (summarizeText):", {uid, error});
      if (error instanceof APIError) {
        throw new HttpsError("internal", `Erro API OpenAI: ${error.message}`);
      } else if (error instanceof Error) {
        throw new HttpsError("internal", `Erro: ${error.message}`);
      } else {
        throw new HttpsError("internal", "Erro desconhecido na IA.");
      }
    }
    throw new HttpsError("internal", "Falha inesperada (summarizeText).");
  }
);

// --- Interfaces para askAIAssistant ---
interface AskAIData {
  question: string;
}
interface AskAIResponse {
  answer: string;
}

// --- NOVA Cloud Function: askAIAssistant ---
export const askAIAssistant = onCall<AskAIData, Promise<AskAIResponse>>(
  {
    // region: "southamerica-east1",
    // timeoutSeconds: 180,
  },
  async (request): Promise<AskAIResponse> => {
    if (!request.auth) {
      logger.warn("Chamada não autenticada para askAIAssistant.");
      throw new HttpsError("unauthenticated", "Usuário não autenticado.");
    }
    const uid = request.auth.uid;

    const userQuestion = request.data.question;
    if (
      !userQuestion ||
      typeof userQuestion !== "string" ||
      userQuestion.trim().length === 0
    ) {
      logger.warn("Pergunta inválida para askAIAssistant.",
        {uid, data: request.data}
      );
      throw new HttpsError(
        "invalid-argument",
        "Pergunta não fornecida ou inválida."
      );
    }

    if (!openai) {
      logger.error(
        "Cliente OpenAI não inicializado (askAIAssistant).",
        {uid}
      );
      throw new HttpsError(
        "internal",
        "Erro interno: IA não configurada corretamente."
      );
    }

    logger.info(`Assistente IA: Pergunta de ${uid}: "${userQuestion}"`, {
      textLength: userQuestion.length,
    });

    try {
      logger.info("Chamando API da OpenAI para o assistente...", {uid});
      const params: ChatCompletionCreateParamsNonStreaming = {
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content:
              "Você é um assistente jurídico experiente e prestativo. " +
              "Sua função é fornecer informações jurídicas claras e " +
              "concisas baseadas em conhecimento geral do direito. Evite " +
              "dar aconselhamento jurídico específico para casos reais, " +
              "pois esta é uma ferramenta de auxílio e pesquisa geral. " +
              "Se a pergunta for muito complexa ou exigir conhecimento " +
              "especializado que você não possui, indique que a questão " +
              "requer a análise de um profissional qualificado.",
          },
          {
            role: "user",
            content: userQuestion,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
      };
      const completion = await openai.chat.completions.create(params);
      logger.info("Assistente IA: Resposta da OpenAI recebida.", {uid});
      const answer = completion.choices[0]?.message?.content?.trim();

      if (!answer) {
        logger.error("Assistente IA: Resposta da OpenAI vazia.", {uid});
        throw new HttpsError(
          "internal",
          "Não foi possível obter uma resposta da IA."
        );
      }
      logger.info("Assistente IA: Retornando resposta.", {
        uid,
        answerLength: answer.length,
      });
      return {answer: answer};
    } catch (error: unknown) {
      logger.error("Assistente IA: Erro API OpenAI:", {uid, error});
      if (error instanceof APIError) {
        throw new HttpsError("internal", `Erro API OpenAI: ${error.message}`);
      } else if (error instanceof Error) {
        throw new HttpsError("internal", `Erro: ${error.message}`);
      } else {
        throw new HttpsError("internal", "Erro desconhecido na IA.");
      }
    }
    throw new HttpsError("internal", "Falha inesperada (askAIAssistant).");
  }
);
// Linha em branco final
