# Normalização de Banco de Dados Relacional

> Material de estudo de exemplo para o app **Estuda Aí**.
> Disciplina: Banco de Dados I. Serve como o "arquivo inteiro" no teste de curadoria de contexto (requisito 3).

## 1. Por que normalizar

Normalização é o processo de organizar as tabelas de um banco de dados relacional para
reduzir a **redundância** de dados e evitar **anomalias** de inserção, atualização e exclusão.
A ideia central é que cada fato seja armazenado uma única vez, em um único lugar. Quando um
mesmo dado se repete em várias linhas, o banco fica sujeito a inconsistências: basta uma
atualização esquecer uma das cópias para que existam dois "valores verdadeiros" diferentes
para a mesma informação.

As três anomalias clássicas são:

- **Anomalia de inserção**: não é possível inserir um fato sem inserir outro que ainda não
  existe. Ex.: não conseguir cadastrar um curso novo enquanto não houver ao menos um aluno
  matriculado nele, porque curso e aluno estão na mesma tabela.
- **Anomalia de atualização**: um mesmo valor aparece repetido em várias linhas e precisa ser
  alterado em todas ao mesmo tempo. Se uma linha for esquecida, o banco fica inconsistente.
- **Anomalia de exclusão**: ao apagar uma linha, perde-se sem querer um fato que só existia
  ali. Ex.: apagar o último aluno de um curso e, com isso, perder a existência do curso.

## 2. Dependência funcional

Uma **dependência funcional** X → Y significa que, para cada valor de X, existe no máximo um
valor de Y associado. Dizemos que Y é *funcionalmente dependente* de X, ou que X *determina* Y.
Por exemplo, `cpf → nome` indica que um CPF determina um único nome. A normalização é definida
em cima do conceito de dependência funcional e do conceito de **chave** (o conjunto mínimo de
atributos que identifica unicamente cada linha).

Um atributo é **primo** se faz parte de alguma chave candidata; caso contrário é **não-primo**.

## 3. Primeira Forma Normal (1FN)

Uma tabela está na **Primeira Forma Normal (1FN)** quando todos os seus atributos são
**atômicos** — ou seja, cada célula guarda um único valor indivisível — e não há grupos de
repetição nem listas dentro de uma mesma coluna. Uma coluna `telefones` guardando
"99999-0000; 98888-1111" viola a 1FN; a correção é separar os telefones em linhas ou em uma
tabela própria. A 1FN é o ponto de partida: sem ela, as demais formas normais nem se aplicam.

## 4. Segunda Forma Normal (2FN)

Uma tabela está na **Segunda Forma Normal (2FN)** quando está na 1FN **e** todos os atributos
não-primos dependem da **chave inteira**, e não apenas de parte dela. Esse conceito só faz
diferença quando a chave é **composta** (formada por mais de um atributo). A violação típica é a
**dependência parcial**: um atributo não-primo depende de apenas um pedaço da chave composta.

Exemplo: em uma tabela `ItemPedido(pedido_id, produto_id, quantidade, nome_produto)`, a chave é
`(pedido_id, produto_id)`. O atributo `nome_produto` depende só de `produto_id` — parte da
chave — e não do pedido. Isso é uma dependência parcial e viola a 2FN. A solução é mover
`nome_produto` para uma tabela `Produto(produto_id, nome_produto)`.

## 5. Terceira Forma Normal (3FN)

Uma tabela está na **Terceira Forma Normal (3FN)** quando está na 2FN **e** nenhum atributo
não-primo depende de outro atributo não-primo. Em outras palavras, não pode haver
**dependência transitiva**: quando um atributo não-chave determina outro atributo não-chave.
A regra é resumida na frase clássica: cada atributo não-primo deve depender "da chave, da chave
inteira e de nada além da chave".

Exemplo: em `Funcionario(cpf, nome, cep, cidade)`, a chave é `cpf`. Mas `cep → cidade`: o CEP
(atributo não-primo) determina a cidade (outro atributo não-primo). Logo, `cidade` depende
transitivamente da chave, através do `cep`. Isso viola a 3FN. A correção é criar uma tabela
`Endereco(cep, cidade)` e deixar apenas `cep` em `Funcionario`. Assim, se uma cidade mudar de
nome, a alteração acontece em um único lugar, eliminando a anomalia de atualização.

## 6. Forma Normal de Boyce-Codd (BCNF)

A **Forma Normal de Boyce-Codd (BCNF)** é uma versão mais rigorosa da 3FN. Uma tabela está em
BCNF quando, para **toda** dependência funcional X → Y não trivial, X é uma **superchave**.
A diferença aparece em tabelas com múltiplas chaves candidatas sobrepostas: uma tabela pode
estar na 3FN e ainda assim ter um determinante que não é superchave, violando a BCNF. Na
prática, a maioria das tabelas em 3FN já está em BCNF; os contraexemplos são raros e envolvem
chaves candidatas compostas que compartilham atributos.

## 7. Desnormalização

Normalizar reduz redundância, mas pode aumentar o número de junções (JOINs) necessárias para
responder uma consulta, o que às vezes prejudica desempenho de leitura. A **desnormalização** é
a decisão deliberada de reintroduzir alguma redundância controlada para acelerar leituras
frequentes — comum em data warehouses e relatórios. É um trade-off consciente: troca-se
integridade automática por velocidade, assumindo o custo de manter as cópias sincronizadas na
aplicação. Desnormalizar sem medir o gargalo real costuma ser otimização prematura.

## 8. Resumo rápido

- **1FN**: valores atômicos, sem grupos de repetição.
- **2FN**: 1FN + sem dependência parcial da chave composta.
- **3FN**: 2FN + sem dependência transitiva entre atributos não-primos.
- **BCNF**: todo determinante é superchave.
- **Desnormalização**: redundância controlada e proposital em troca de desempenho.
